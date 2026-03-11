import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Check, X, Info, AlertCircle, MessageSquare, Calendar, BellRing } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import toast from "react-hot-toast";

export default function NotificationsPanel({ onClose }) {
  const { notifications, markAsRead, markAllAsRead, clearNotification } = useNotifications();
  const navigate = useNavigate();
  const [permissionState, setPermissionState] = useState("default");

  // Check the phone's current notification permission status when the panel opens
  useEffect(() => {
    if ("Notification" in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Ask the mobile OS for permission when they click the button
  const requestSystemNotification = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser does not support system notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission === "granted") {
        toast.success("Mobile notifications enabled!");
      } else if (permission === "denied") {
        toast.error("Notifications were denied. Please allow them in your phone settings.");
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "EVENT": return <Calendar size={18} className="text-emerald-600" />;
      case "COMPLAINT": return <AlertCircle size={18} className="text-amber-600" />;
      case "MESSAGE": return <MessageSquare size={18} className="text-blue-600" />;
      default: return <Info size={18} className="text-zinc-600" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="fixed left-4 right-4 top-20 md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-96 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden z-50 origin-top-right flex flex-col max-h-[80vh]"
    >
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 backdrop-blur-sm shrink-0">
        <h3 className="font-bold text-zinc-900">Notifications</h3>
        {notifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* --- NEW: MOBILE PERMISSION BANNER --- */}
      {permissionState === "default" && (
        <div className="bg-emerald-50 border-b border-emerald-100 p-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-full text-emerald-600 shrink-0">
              <BellRing size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 mb-1">Turn on alerts</h4>
              <p className="text-xs text-zinc-600 mb-3">Get instant push notifications on your phone for events and approvals.</p>
              <button
                onClick={requestSystemNotification}
                className="text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
              >
                Enable Notifications
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- END BANNER --- */}

      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar flex-1">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center">
              <Bell size={20} className="opacity-50" />
            </div>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "w-full text-left p-4 hover:bg-zinc-50 transition-colors flex gap-3 relative group cursor-pointer",
                  !notification.isRead && "bg-emerald-50/30 hover:bg-emerald-50/50"
                )}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearNotification(notification.id);
                  }}
                  className="absolute right-2 top-2 px-2 py-1 bg-white/50 hover:bg-red-50 text-zinc-400 hover:text-red-600 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all z-10 border border-zinc-100 hover:border-red-100 shadow-sm"
                  title="Clear notification"
                >
                  Clear
                </button>
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  notification.type === "EVENT" && "bg-emerald-100",
                  notification.type === "COMPLAINT" && "bg-amber-100",
                  notification.type === "MESSAGE" && "bg-blue-100",
                  notification.type === "INFO" && "bg-zinc-100"
                )}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium text-zinc-900 truncate pr-4", !notification.isRead && "font-bold")}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1.5 font-medium">
                    {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="absolute right-4 top-4 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}