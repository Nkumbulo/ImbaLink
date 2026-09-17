/** Canonical notification read/ack and realtime service. */
export function createNotificationService({ supabase, activeUserKey }) {
  const mapRow = (row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || '',
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  });

  async function getNotifications(limit = 30) {
    const userId = activeUserKey();
    if (!userId) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, subject_type, subject_id, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(mapRow);
  }

  async function getUnreadNotificationCount() {
    if (!activeUserKey()) return 0;
    const { data, error } = await supabase.rpc('get_unread_notification_count');
    if (error) return 0;
    return Number(data) || 0;
  }

  async function markNotificationRead(notificationId) {
    const id = String(notificationId || '').trim();
    if (!id) return;
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
    if (error) console.warn('mark_notification_read failed:', error.message);
  }

  async function markAllNotificationsRead() {
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) console.warn('mark_all_notifications_read failed:', error.message);
  }

  async function resetAllNotifications() {
    const { error } = await supabase.rpc('reset_all_notifications');
    if (error) {
      console.warn('reset_all_notifications failed:', error.message);
      throw error;
    }
  }

  function subscribeToNotifications(userId, onInsert) {
    const uid = String(userId || '').trim();
    if (!uid) return () => {};
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload?.new;
          if (!row || String(row.user_id) !== uid) return;
          onInsert(mapRow(row));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  return {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    resetAllNotifications,
    subscribeToNotifications,
  };
}
//: notification persistence moved behind the Core service boundary.
