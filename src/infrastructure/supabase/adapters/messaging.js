import { supabase } from '../client';

const messageRow = (row, userId) => ({
  id: String(row.id),
  conversationId: String(row.conversation_id),
  senderId: String(row.sender_user_id),
  receiverId: row.receiver_user_id ? String(row.receiver_user_id) : null,
  text: row.body || '',
  createdAt: row.sent_at ? new Date(row.sent_at).getTime() : Date.now(),
  status: 'sent',
  clientKey: row.client_key || null,
  relatedPropertyId: row.related_property_id ? String(row.related_property_id) : null,
  isMine: String(row.sender_user_id) === String(userId),
});

async function loadMessages(conversationId, userId, options = {}) {
  const params = {
    p_conversation_id: String(conversationId),
    p_limit: Math.min(Math.max(Number(options.limit) || 100, 1), 100),
  };
  if (options.cursor?.sentAt && options.cursor?.id) {
    params.p_after_sent_at = new Date(options.cursor.sentAt).toISOString();
    params.p_after_id = String(options.cursor.id);
  }

  const { data, error } = await supabase.rpc('get_conversation_messages', params);
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const ordered = options.cursor?.sentAt && options.cursor?.id ? rows : rows.slice().reverse();
  return ordered.map((row) => messageRow(row, userId));
}

export const supabaseMessageRepository = Object.freeze({
  async getConversations(userId, options = {}) {
    if (!userId) return [];
    const { data, error } = await supabase.rpc('get_conversation_previews', {
      p_limit: Math.min(Math.max(Number(options.limit) || 20, 1), 100),
      p_before: options.before || null,
    });
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return [];

    // Conversation previews intentionally come from the lightweight RPC, but
    // the RPC only returns IDs and message-preview data.  The old messaging
    // provider also resolved the other participant's public profile here.
    // Without that resolution the backend-contract migration produced
    // perfectly valid conversations whose UI displayName/displayAvatar were
    // empty, which is why the inbox showed '?' instead of names/photos.
    const propertyIds = [...new Set(rows.filter((r) => r.property_id).map((r) => String(r.property_id)))];
    const otherUserIds = [...new Set(rows.filter((r) => r.other_user_id).map((r) => String(r.other_user_id)))];

    const [propertiesRes, contractorsRes, profilesRes] = await Promise.all([
      propertyIds.length
        ? supabase.from('properties').select('id, landlord_name, gradient').in('id', propertyIds)
        : Promise.resolve({ data: [] }),
      otherUserIds.length
        ? supabase.from('contractors').select('id, user_id, business_name').in('user_id', otherUserIds)
        : Promise.resolve({ data: [] }),
      otherUserIds.length
        ? supabase.from('public_user_profiles').select('id, first_name, surname, display_name, avatar_url').in('id', otherUserIds)
        : Promise.resolve({ data: [] }),
    ]);

    if (propertiesRes.error) throw propertiesRes.error;
    if (contractorsRes.error) throw contractorsRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const propertiesById = new Map((propertiesRes.data || []).map((p) => [String(p.id), p]));
    const contractorsByUserId = new Map((contractorsRes.data || []).map((c) => [String(c.user_id), c]));
    const profilesById = new Map((profilesRes.data || []).map((p) => [String(p.id), p]));

    return rows.map((row) => {
      const otherUserId = row.other_user_id ? String(row.other_user_id) : null;
      const propertyId = row.property_id ? String(row.property_id) : null;
      const property = propertyId ? propertiesById.get(propertyId) : null;
      const profile = otherUserId ? profilesById.get(otherUserId) : null;
      const contractor = otherUserId ? contractorsByUserId.get(otherUserId) : null;
      const profileName = profile?.display_name || [profile?.first_name, profile?.surname].filter(Boolean).join(' ').trim();

      let type = 'property';
      let displayName = profileName || property?.landlord_name || 'Landlord';
      let displayAvatar = {
        kind: 'avatar',
        url: profile?.avatar_url || null,
        grad: Array.isArray(property?.gradient) ? property.gradient : null,
        letter: displayName.charAt(0).toUpperCase() || '?',
      };
      let contractorId = null;
      let roommateId = null;

      if (!propertyId) {
        if (contractor) {
          type = 'contractor';
          contractorId = String(contractor.id);
          displayName = contractor.business_name || 'Contractor';
          displayAvatar = { kind: 'wrench' };
        } else {
          type = 'roommate';
          roommateId = otherUserId;
          displayName = profileName || 'User';
          displayAvatar = {
            kind: 'avatar',
            url: profile?.avatar_url || null,
            grad: null,
            letter: displayName.charAt(0).toUpperCase() || 'U',
          };
        }
      }

      return {
      id: String(row.conversation_id),
      type,
      participants: otherUserId
        ? [String(userId), otherUserId]
        : [String(userId)],
      propertyId,
      contractorId,
      roommateId,
      displayName,
      displayAvatar,
      lastMessage: row.last_message_body
        ? {
            id: `${row.conversation_id}-preview`,
            conversationId: String(row.conversation_id),
            senderId: row.last_message_sender_id ? String(row.last_message_sender_id) : null,
            receiverId: String(userId),
            text: row.last_message_body,
            createdAt: row.last_message_sent_at ? new Date(row.last_message_sent_at).getTime() : Date.now(),
            status: 'sent',
          }
        : null,
      lastMessageAt: row.last_message_sent_at
        ? new Date(row.last_message_sent_at).getTime()
        : row.updated_at ? new Date(row.updated_at).getTime() : null,
      unreadCount: Number(row.unread_count) || 0,
      messages: [],
      };
    });
  },

  async getMessages(conversationId, userId, options = {}) {
    return loadMessages(conversationId, userId, options);
  },

  async sendMessage(conversationId, message = {}) {
    const text = String(message.text || '').trim().slice(0, 2000);
    if (!text) throw new Error('Cannot send an empty message.');

    const { data, error } = await supabase.rpc('send_message_atomic', {
      p_conversation_id: String(conversationId),
      p_recipient_user_id: message.recipientId ? String(message.recipientId) : null,
      p_property_id: message.propertyId ? String(message.propertyId) : null,
      p_body: text,
      p_client_key: message.clientKey ? String(message.clientKey) : null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error('Message was not confirmed by the server.');
    return messageRow(row, row.sender_user_id);
  },

  async markConversationRead(conversationId, _userId, readThrough = null) {
    const { data, error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: String(conversationId),
      p_read_through: readThrough ? new Date(readThrough).toISOString() : null,
    });
    if (error) throw error;
    return data ?? true;
  },
});

export const supabaseConversationRepository = Object.freeze({
  async getConversation(conversationId, userId) {
    const id = String(conversationId || '');
    if (!id || !userId) return null;

    const { data: row, error } = await supabase
      .from('conversations')
      .select('id, property_id, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    const { data: participants, error: participantError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id);
    if (participantError) throw participantError;

    const participantIds = (participants || []).map((p) => String(p.user_id));
    const otherUserId = participantIds.find((participantId) => participantId !== String(userId)) || null;
    const propertyId = row.property_id ? String(row.property_id) : null;

    // Resolve the same public identity metadata used by the inbox preview so
    // opening a thread cannot lose the name/photo during the contract
    // migration.  The UI expects displayName/displayAvatar on the canonical
    // conversation object.
    const [profileRes, propertyRes] = await Promise.all([
      otherUserId
        ? supabase.from('public_user_profiles').select('id, first_name, surname, display_name, avatar_url').eq('id', otherUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      propertyId
        ? supabase.from('properties').select('id, landlord_name, gradient').eq('id', propertyId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (propertyRes.error) throw propertyRes.error;

    const profile = profileRes.data;
    const property = propertyRes.data;
    const displayName =
      profile?.display_name ||
      [profile?.first_name, profile?.surname].filter(Boolean).join(' ').trim() ||
      property?.landlord_name ||
      'User';
    const displayAvatar = {
      kind: 'avatar',
      url: profile?.avatar_url || null,
      grad: Array.isArray(property?.gradient) ? property.gradient : null,
      letter: displayName.charAt(0).toUpperCase() || 'U',
    };

    const messages = await loadMessages(id, userId);
    return {
      id,
      participants: participantIds,
      propertyId,
      displayName,
      displayAvatar,
      lastMessage: messages[messages.length - 1] || null,
      lastMessageAt: messages.length ? messages[messages.length - 1].createdAt : row.updated_at ? new Date(row.updated_at).getTime() : null,
      unreadCount: 0,
      messages,
    };
  },

  async createConversation({ participants = [], propertyId = null } = {}) {
    const others = participants.filter(Boolean).map(String);
    if (propertyId != null) {
      const { data, error } = await supabase.rpc('ensure_property_conversation', {
        p_property_id: String(propertyId),
      });
      if (error) throw error;
      return { id: String(data), participants: others, propertyId: String(propertyId), messages: [] };
    }

    const current = others[0];
    const other = others[1];
    if (!other) throw new Error('A second conversation participant is required.');
    const { data, error } = await supabase.rpc('ensure_direct_conversation', {
      p_other_user_id: String(other),
    });
    if (error) throw error;
    return { id: String(data), participants: [current, other], propertyId: null, messages: [] };
  },
});
