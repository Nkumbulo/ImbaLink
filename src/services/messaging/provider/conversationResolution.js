import { supabase } from "../../supabase";
import { db } from "../../database";

// Mixed into SupabaseMessagingProvider.prototype — see connectionState.js for
// why cross-file `this.method()` calls are safe. This file is the resolution
// core other mixins (conversationLoading.js, messageActions.js) depend on.
export const conversationResolutionMethods = {
  async _resolveProperty(propertyId) {
    const key = String(propertyId);
    // properties has no `landlord` or `grad` columns — the real columns are
    // `landlord_name` and `gradient` (see database.js's own read/write
    // mapping, e.g. `landlord: row.landlord_name`). Selecting the wrong
    // names here made PostgREST reject the query outright with a 400,
    // which made every property-conversation lookup fail silently
    // (_resolveConversationMeta would see `error` and return exists:false),
    // independent of anything else in the messaging path.
    const { data, error } = await supabase
      .from('properties')
      .select('id, owner_user_id, landlord_name, gradient')
      .eq('id', key)
      .maybeSingle();
    if (!error && data) {
      return {
        id: String(data.id),
        ownerUserId: data.owner_user_id ? String(data.owner_user_id) : null,
        landlord: data.landlord_name || 'Landlord',
        grad: Array.isArray(data.gradient) && data.gradient.length ? data.gradient : null,
      };
    }
    return null;
  },

  // `currentUserId` lets this correctly resolve "the other participant"
  // from BOTH sides of a conversation. The property/contractor/roommate
  // lookups below always resolve to one fixed identity (e.g. the listing
  // owner) — that's correct when the current viewer is the tenant, but
  // wrong when the current viewer *is* that fixed identity (the landlord
  // replying to their own listing's conversation): without this, the
  // landlord's own id would be reported as "the other participant", and
  // sendMessage() would then refuse with "Cannot message yourself." Once a
  // conversation actually has participant rows, whichever one isn't the
  // current user is the real recipient, regardless of conversation type.
  async _resolveConversationMeta(conversationId, currentUserId) {
    const key = String(conversationId);
    const meta = await this._resolveConversationMetaBase(key, currentUserId);

    if (currentUserId) {
      // A property conversation whose real id has the
      // "<propertyId>::<tenantId>" shape already has a DEFINITIVE
      // otherParticipantId — parsed directly out of the id itself in
      // _propertyMeta() above, which only request_property_viewing() ever
      // produces and always suffixes with the real requester's own
      // auth.uid(). That can never be led astray by a stray extra
      // participant row, unlike querying conversation_participants and
      // guessing which one "isn't me" below — which is only as reliable
      // as the data, and a conversation created before this scoping
      // existed can still have a leftover extra participant baked in.
      // Skip the guesswork entirely when we already know the answer for
      // certain.
      const hasDefinitiveOther = meta.type === 'property' && meta.id.includes('::');

      let other = hasDefinitiveOther ? meta.otherParticipantId : null;

      if (!hasDefinitiveOther) {
        const { data: participantRows } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', meta.id);
        const others = (participantRows || [])
          .map((r) => String(r.user_id))
          .filter((id) => id !== String(currentUserId));

        // A conversation is meant to be exactly 2 people. It should never
        // have more than one "other" participant — but a bug fixed in the
        // SQL migration (a global, non-tenant-scoped fallback conversation
        // id) could previously merge unrelated people into one shared
        // thread, and a conversation created before that fix may still have
        // that stale extra participant. There's no way to algorithmically
        // know which one is "correct" once that's happened for a thread
        // that has no definitive id-encoded answer (see above) — this is a
        // real data problem, not something a read query can fix — so this
        // at least (a) prefers the base guess when it's among the
        // candidates, and (b) sorts the remainder so the choice is at least
        // STABLE, non-flickering across reloads instead of "whichever row
        // Postgres happened to return first" (unordered queries have no
        // guaranteed row order), and warns loudly so it's caught instead of
        // silently shown as if it were correct.
        if (others.length > 1) {
          console.warn(
            `Conversation ${meta.id} has ${others.length} other participants — expected exactly 1. ` +
            `This conversation predates the collision fixes and needs manual cleanup ` +
            `(see the diagnostic query for finding these).`,
            others
          );
          other = meta.otherParticipantId && others.includes(meta.otherParticipantId)
            ? meta.otherParticipantId
            : [...others].sort()[0];
        } else {
          other = others[0] || null;
        }
      }

      // Always look up the real participant's own profile when we know who
      // they are — not just when they differ from the base guess. The base
      // guess (property landlord_name) can be numerically correct as an id
      // (e.g. the tenant's own view of the landlord) while still having no
      // photo to offer, since a property record has no avatar field. Only
      // a real account has a picture, so this is the only path that can
      // ever supply one — skipping it whenever the id "already matched"
      // meant the tenant's side never got the landlord's actual photo,
      // only the landlord's side did. Scoped to person-to-person threads
      // (property/roommate) — a contractor thread's business_name + wrench
      // icon is a deliberate business identity, not a personal one, so
      // it's left as-is rather than silently swapped for a personal photo.
      if (other && meta.type !== 'contractor') {
        const profile = await this._resolveUserProfile(other);
        if (profile) {
          meta.displayName = profile.displayName;
          meta.displayAvatar = profile.displayAvatar;
        }
      }
      if (other) meta.otherParticipantId = other;
    }

    return meta;
  },

  // Looks up a real person's own name/avatar for display — used when "the
  // other participant" turns out not to be the fixed identity a
  // property/contractor/roommate lookup assumes (see above). Reads from
  // public_user_profiles, the one cross-account-readable view that exposes
  // a display name and avatar without exposing phone/email.
  async _resolveUserProfile(userId) {
    const { data, error } = await supabase
      .from('public_user_profiles')
      .select('id, first_name, surname, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    const name =
      data.display_name ||
      [data.first_name, data.surname].filter(Boolean).join(' ').trim() ||
      'User';
    return {
      displayName: name,
      // `url` carries the real photo (e.g. their Google account picture)
      // through to the UI now that the Messages page renders it via the
      // shared <Avatar src=.../> component, with `letter`/`grad` kept as
      // the fallback for accounts with no photo or when it fails to load.
      displayAvatar: { kind: 'avatar', url: data.avatar_url || null, grad: null, letter: name.charAt(0).toUpperCase() },
    };
  },

  // Finds a conversation the CURRENT user already has with otherUserId,
  // regardless of which property/contractor/roommate it started from.
  // Mirrors find_conversation_with() in the SQL migration — used so that,
  // e.g., messaging a second listing from a landlord you already have an
  // open thread with continues that thread instead of starting a new one.
  async _findConversationWith(otherUserId) {
    if (!otherUserId) return null;
    const { data, error } = await supabase.rpc('find_conversation_with', {
      p_other_user_id: String(otherUserId),
    });
    if (error) return null;
    return data ? String(data) : null;
  },

  // Canonical, order-independent conversation id for a direct (contractor
  // or roommate) 1:1 thread — mirrors dm_pair_id() in the SQL migration
  // exactly (must produce byte-identical output, since this is used to
  // read/write the same rows the server computes this same id for). A
  // pure function of the two participant ids, so — unlike the property
  // case — no existence lookup is needed: the same two people always
  // compute the same id.
  _dmPairId(a, b) {
    const [lo, hi] = [String(a), String(b)].sort();
    return `dm_${lo}_${hi}`;
  },

  // `key` here is the ROUTING key a caller navigated in with — a bare
  // property id (from a property page), "contractor_<id>"/"roommate_<id>"
  // (from those pages), or already the REAL conversation id (opened from
  // the inbox, where conversation.id is whatever the RPCs actually stored
  // — which, since the fixes above, may be "<propertyId>::<tenantId>" or
  // "dm_<a>_<b>", not necessarily the routing-key shape at all). This
  // tries each interpretation in turn instead of assuming the routing-key
  // shape always holds, which is what broke the LANDLORD's own inbox view
  // after the tenant-scoped id fix: _resolveProperty(key) stopped matching
  // once `key` became a scoped id rather than a bare property id.
  async _resolveConversationMetaBase(conversationId, currentUserId) {
    const key = String(conversationId);
    if (key.startsWith("contractor_")) {
      const contractorId = key.slice("contractor_".length);
      const { data: contractor, error } = await supabase
        .from('contractors')
        .select('id, user_id, business_name')
        .eq('id', contractorId)
        .maybeSingle();
      const businessName = contractor?.business_name || 'Contractor';
      const otherParticipantId = contractor?.user_id ? String(contractor.user_id) : null;
      return {
        // The real storage id is the dm-pair, computed directly — not the
        // routing key, which is tied only to the contractor and would be
        // reused (and collided on) by every different customer.
        id: currentUserId && otherParticipantId ? this._dmPairId(currentUserId, otherParticipantId) : key,
        type: 'contractor',
        propertyId: null,
        contractorId,
        roommateId: null,
        otherParticipantId,
        displayName: businessName,
        displayAvatar: { kind: 'wrench' },
        exists: !error && Boolean(contractor),
      };
    }

    // Find a Roommate: roommate threads resolve against real student
    // profiles. The old in-memory demo candidate directory was removed so
    // messaging follows the same database-backed roommate architecture as
    // RoommateFinderPage.jsx.
    if (key.startsWith("roommate_")) {
      const roommateId = key.slice("roommate_".length);
      const profile = await db.findProfileById(roommateId).catch(() => null);
      const name = profile?.name || profile?.firstName || "Student";
      return {
        id: currentUserId ? this._dmPairId(currentUserId, roommateId) : key,
        type: "roommate",
        propertyId: null,
        contractorId: null,
        roommateId,
        otherParticipantId: roommateId,
        displayName: name,
        displayAvatar: { kind: "avatar", grad: null, letter: (name || "?").charAt(0) },
        exists: Boolean(profile),
      };
    }

    // Try `key` as a bare property id first — the common case (opened
    // from a property page).
    let property = await this._resolveProperty(key);
    if (property) {
      return this._propertyMeta(key, key, property, currentUserId);
    }

    // Not a property id — this is either a real, already-scoped
    // conversation id (opened from the inbox) or unresolvable. Look up
    // what it actually is from the conversations table itself (readable
    // under RLS only if the caller is genuinely a participant) instead of
    // guessing from the id's shape.
    const { data: conversationRow } = await supabase
      .from('conversations')
      .select('id, property_id')
      .eq('id', key)
      .maybeSingle();

    if (conversationRow?.property_id) {
      // A property thread whose id doesn't match its own property's id —
      // e.g. "<propertyA>::<tenant>" opened by the landlord, or a
      // conversation reused across several of the landlord's listings.
      // conversations.property_id always points at a real property owned
      // by the same landlord this thread is with, so it's still the
      // correct source for the landlord's identity even if it's not
      // necessarily the specific listing the message was about.
      const realProperty = await this._resolveProperty(String(conversationRow.property_id));
      return this._propertyMeta(key, String(conversationRow.property_id), realProperty, currentUserId);
    }

    if (conversationRow && currentUserId) {
      // No property_id: a direct (contractor/roommate) thread. Find the
      // other participant directly and resolve who they actually are —
      // a business (contractors row exists for them) or a plain person.
      const { data: participantRows } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', key);
      const otherParticipantId = (participantRows || [])
        .map((r) => String(r.user_id))
        .find((id) => id !== String(currentUserId)) || null;

      if (otherParticipantId) {
        const { data: contractorRow } = await supabase
          .from('contractors')
          .select('id, business_name')
          .eq('user_id', otherParticipantId)
          .maybeSingle();
        if (contractorRow) {
          return {
            id: key,
            type: 'contractor',
            propertyId: null,
            contractorId: contractorRow.id,
            roommateId: null,
            otherParticipantId,
            displayName: contractorRow.business_name || 'Contractor',
            displayAvatar: { kind: 'wrench' },
            exists: true,
          };
        }
        const profile = await this._resolveUserProfile(otherParticipantId);
        return {
          id: key,
          type: 'roommate',
          propertyId: null,
          contractorId: null,
          roommateId: otherParticipantId,
          otherParticipantId,
          displayName: profile?.displayName || 'User',
          displayAvatar: profile?.displayAvatar || { kind: 'avatar', grad: null, letter: '?' },
          exists: true,
        };
      }
    }

    // Nothing resolved: not a real property, not a real conversation this
    // caller is part of (or it doesn't exist at all).
    return {
      id: key,
      type: "property",
      propertyId: key,
      contractorId: null,
      roommateId: null,
      otherParticipantId: null,
      displayName: "",
      displayAvatar: { kind: "avatar", grad: null, letter: "?" },
      exists: false,
    };
  },

  // Shared by both ways of reaching a property conversation above: `key`
  // (the routing/caller-supplied id) may need to be resolved to a
  // DIFFERENT real conversation id if the current user already has one
  // with this same landlord from another listing — see
  // find_conversation_with() in the SQL migration.
  async _propertyMeta(key, propertyId, property, currentUserId) {
    const landlordName = property?.landlord || "Landlord";
    const ownerId = property?.ownerUserId ? String(property.ownerUserId) : null;

    let id = key;
    let otherParticipantId = ownerId;

    if (currentUserId && ownerId && String(currentUserId) !== ownerId) {
      // Tenant's view: reuse an existing conversation with this landlord
      // from another property, if any (see find_conversation_with()).
      const existing = await this._findConversationWith(ownerId).catch(() => null);
      if (existing) id = existing;
    } else if (currentUserId && ownerId && String(currentUserId) === ownerId) {
      // Landlord's own view. `id` here (via currentThreadRealId from the
      // inbox — see MessagesPage.jsx) should already be the real
      // conversation id, which for anything created after the
      // tenant-scoping fix has the shape "<propertyId>::<tenantId>" (see
      // request_property_viewing() in the SQL migration). Parse the
      // tenant id straight out of that suffix instead of querying
      // conversation_participants and guessing which row "isn't me" — the
      // parsed value is authoritative by construction (only
      // request_property_viewing ever produces this exact shape, always
      // suffixed with the real requester's own auth.uid()), so it can
      // NEVER be led astray by a stray extra participant row, whereas a
      // guess from the participants table is only as clean as that data.
      // This is the actual fix for "a third, unrelated person shows up in
      // what should be a private 2-person conversation" — the previous
      // participant-query-and-guess approach could only ever be as
      // reliable as the data, and a conversation created before this
      // scoping existed (or before it's been re-run) can still have a
      // leftover extra participant baked in.
      const suffixIdx = id.lastIndexOf('::');
      if (suffixIdx !== -1) {
        otherParticipantId = id.slice(suffixIdx + 2);
      }
      // No "::" suffix: a legacy/unscoped conversation id (predates this
      // fix). otherParticipantId stays as ownerId here (wrong for the
      // landlord's own view, same as before) — the wrapper below falls
      // back to the old participant-query approach specifically for this
      // case, which is the best that's possible without a real,
      // structural way to know who the tenant is.
    }

    return {
      id,
      type: "property",
      propertyId,
      contractorId: null,
      roommateId: null,
      otherParticipantId,
      displayName: landlordName,
      displayAvatar: { kind: "avatar", grad: property?.grad || null, letter: (landlordName || "?").charAt(0) },
      exists: Boolean(property) && Boolean(ownerId),
    };
  },
};
