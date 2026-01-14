import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notification } from '@/types';
import { api } from '@/utils/api';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Bell, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const response = await api.get<Notification[]>('/api/notifications?isRead=false');
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.post(`/api/notifications/${notificationId}/read`);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/api/notifications/read-all');
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // SCHEDULE_INVITEの場合はクリックでリンクに移動しない（ボタンで操作）
    if (notification.type === 'SCHEDULE_INVITE') {
      return;
    }
    await markAsRead(notification.id);
    setIsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleScheduleInviteResponse = async (notification: Notification, decision: 'APPROVED' | 'REJECTED') => {
    try {
      // linkからscheduleIdを抽出（例: /schedule/123）
      const scheduleId = notification.link?.split('/').pop();
      if (!scheduleId) {
        alert('スケジュールIDが見つかりません');
        return;
      }

      await api.post(`/api/schedules/${scheduleId}/respond`, { decision });
      await markAsRead(notification.id);
      await loadNotifications();
      // スケジュールページをリロードするために通知
      window.dispatchEvent(new CustomEvent('schedule-updated'));
    } catch (error) {
      console.error('Failed to respond to schedule invite:', error);
      alert('応答に失敗しました');
    }
  };

  useEffect(() => {
    loadNotifications();
    // ポーリング: 30秒ごとに通知を更新
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'TASK_REQUEST':
        return '📋';
      case 'SCHEDULE_SUGGESTION':
        return '📅';
      case 'PROJECT_APPROVED':
        return '✅';
      case 'PROJECT_REJECTED':
        return '❌';
      case 'WEEKLY_REMINDER':
        return '📝';
      case 'SNS_REMINDER':
        return '📱';
      case 'PENDING_SCHEDULE':
        return '⏳';
      case 'EVENT_REMINDER':
        return '🎉';
      case 'SCHEDULE_INVITE':
        return '📅';
      case 'SCHEDULE_INVITE_APPROVED':
        return '✅';
      case 'SCHEDULE_INVITE_REJECTED':
        return '❌';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 rounded-full w-5 h-5 p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute right-0 mt-2 w-96 max-h-96 overflow-y-auto shadow-lg z-50">
            <div className="p-3 border-b flex justify-between items-center bg-gray-50">
              <span className="font-semibold text-gray-800">通知</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  全て既読
                </Button>
              )}
            </div>

            <div>
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">通知はありません</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => notification.type !== 'SCHEDULE_INVITE' && handleNotificationClick(notification)}
                    className={`p-3 border-b transition-colors ${
                      notification.type === 'SCHEDULE_INVITE' ? '' : 'hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 mb-1">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(notification.createdAt), 'M月d日 HH:mm', { locale: ja })}
                        </p>
                        {notification.type === 'SCHEDULE_INVITE' && (
                          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => handleScheduleInviteResponse(notification, 'APPROVED')}
                              className="flex items-center gap-1 text-xs"
                            >
                              <Check className="w-3 h-3" />
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleScheduleInviteResponse(notification, 'REJECTED')}
                              className="flex items-center gap-1 text-xs"
                            >
                              <X className="w-3 h-3" />
                              却下
                            </Button>
                          </div>
                        )}
                      </div>
                      {notification.type !== 'SCHEDULE_INVITE' && (
                        <Check className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
