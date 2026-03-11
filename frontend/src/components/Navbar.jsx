import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { 
  LogOut, 
  PlusCircle, 
  LayoutDashboard, 
  ShieldCheck, 
  Ticket,
  User,
  ListChecks,
  MessageSquareWarning,
  Clock,
  Menu,
  X,
  Bell,
  Megaphone,
  GraduationCap
} from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import NotificationsPanel from "./NotificationsPanel";
import { AnimatePresence } from "motion/react";

export default function Navbar({ user, profile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  
  // Safe access to notification context
  let notificationsContext = { unreadCount: 0 };
  try {
    notificationsContext = useNotifications();
  } catch (e) {
    // Context might not be available yet
  }
  const { unreadCount } = notificationsContext || { unreadCount: 0 };

  const handleLogout = async () => {
    await signOut(auth);
    // CRITICAL FIX: Clear the specific ad session memory for the new sequence logic
    sessionStorage.removeItem("lastAdShownUser");
    navigate("/login");
    setIsMenuOpen(false);
  };

  // Close menu when location changes
  useEffect(() => {
    setIsMenuOpen(false);
    setShowNotifications(false);
  }, [location]);

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

  return (
    <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* --- LOGO SECTION --- */}
        <Link to="/" className="flex items-center gap-2 md:gap-3 hover:opacity-90 transition-opacity shrink-0 relative z-50">
          {/* First Logo: SNMIMT */}
          <img 
            src="https://res.cloudinary.com/dtzdgkimi/image/upload/v1772819497/logo4_mswif1.png" 
            alt="SNMIMT Logo" 
            className="h-8 md:h-10 w-auto object-contain rounded-md" 
          />
          
          {/* Subtle Vertical Divider */}
          <div className="h-6 md:h-8 w-px bg-zinc-200"></div>
          
          {/* Second Logo: CampusBridge */}
          <img 
            src="https://res.cloudinary.com/dtzdgkimi/image/upload/v1772822941/Gemini_Generated_Image_rwqg4rwqg4rwqg4r_ojz2j1.png" 
            alt="CampusBridge Logo" 
            className="h-6 md:h-8 w-auto object-contain" 
          />
        </Link>
        {/* -------------------- */}

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1 md:gap-4">
          {user ? (
            <>
              {profile && (
                <>
                  {/* Dashboard and Complaints for all users */}
                  <Link 
                    to="/dashboard" 
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                    title="Dashboard"
                  >
                    <LayoutDashboard size={20} />
                    <span className="text-sm font-medium">Dashboard</span>
                  </Link>
    
                  <Link 
                    to="/complaints" 
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                    title="Complaints"
                  >
                    <MessageSquareWarning size={20} />
                    <span className="text-sm font-medium">Complaints</span>
                  </Link>

                  <Link 
                    to="/notices" 
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                    title="Notice Board"
                  >
                    <Megaphone size={20} />
                    <span className="text-sm font-medium">Notices</span>
                  </Link>

                  <Link 
                    to="/campus-connect" 
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                    title="Campus Connect"
                  >
                    <GraduationCap size={20} />
                    <span className="text-sm font-medium">Campus Connect</span>
                  </Link>

                  {profile.role === "student" && (
                    <>
                      <Link 
                        to="/create-event" 
                        className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                        title="Host Event"
                      >
                        <PlusCircle size={20} />
                        <span className="text-sm font-medium">Host Event</span>
                      </Link>
                      <Link 
                        to="/my-registrations" 
                        className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                        title="My Tickets"
                      >
                        <Ticket size={20} />
                        <span className="text-sm font-medium">My Tickets</span>
                      </Link>
                      <Link 
                        to="/my-events" 
                        className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                        title="My Events"
                      >
                        <ListChecks size={20} />
                        <span className="text-sm font-medium">My Events</span>
                      </Link>
                    </>
                  )}

                  {profile.role === "management" && (
                    <Link 
                      to="/management" 
                      className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                      title="Management"
                    >
                      <ShieldCheck size={20} />
                      <span className="text-sm font-medium">Management</span>
                    </Link>
                  )}

                  {profile.role === "management" && profile.isApproved === false && (
                    <div className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg flex items-center gap-2 border border-amber-100">
                      <Clock size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Pending Approval</span>
                    </div>
                  )}

                  {/* Notification Bell */}
                  <div className="relative" ref={notificationRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all relative"
                      title="Notifications"
                    >
                      <Bell size={20} />
                      {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                      )}
                    </button>
                    <AnimatePresence>
                      {showNotifications && (
                        <NotificationsPanel onClose={() => setShowNotifications(false)} />
                      )}
                    </AnimatePresence>
                  </div>

                  <Link 
                    to="/account" 
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all flex items-center gap-2"
                    title="Account"
                  >
                    <User size={20} />
                    <span className="text-sm font-medium">Account</span>
                  </Link>

                  <div className="h-6 w-px bg-zinc-200 mx-2" />
                </>
              )}

              <button
                onClick={handleLogout}
                className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-2"
                title="Logout"
              >
                <LogOut size={20} />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link 
                to="/login" 
                className="px-4 py-2 text-sm font-bold text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Login
              </Link>
              <Link 
                to="/login" 
                className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button & Notification */}
        <div className="lg:hidden flex items-center gap-2">
          {user && profile && (
             <div className="relative" ref={notificationRef}>
             <button
               onClick={() => setShowNotifications(!showNotifications)}
               className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all relative"
             >
               <Bell size={24} />
               {unreadCount > 0 && (
                 <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
               )}
             </button>
             <AnimatePresence>
                {showNotifications && (
                  <NotificationsPanel onClose={() => setShowNotifications(false)} />
                )}
              </AnimatePresence>
           </div>
          )}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all relative z-50"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="fixed inset-0 bg-white z-40 lg:hidden pt-24 pb-8 px-6 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {user ? (
                <>
                  {profile && (
                    <>
                      <div className="mb-6 pb-6 border-b border-zinc-100">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-xl font-bold text-zinc-400">
                            {profile.displayName?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900">{profile.displayName}</div>
                            <div className="text-sm text-zinc-500">{profile.email}</div>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-[10px] font-bold uppercase tracking-wider text-zinc-600 border border-zinc-200">
                          <ShieldCheck size={10} />
                          {profile.email === "campusbridgeofficials@gmail.com" ? "developer" : profile.role}
                        </div>
                      </div>

                      {/* Dashboard and Complaints for all users */}
                      <Link 
                        to="/dashboard" 
                        className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                      >
                        <LayoutDashboard size={24} />
                        <span className="font-bold">Dashboard</span>
                      </Link>
        
                      <Link 
                        to="/complaints" 
                        className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                      >
                        <MessageSquareWarning size={24} />
                        <span className="font-bold">Complaints</span>
                      </Link>

                      <Link 
                        to="/notices" 
                        className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                      >
                        <Megaphone size={24} />
                        <span className="font-bold">Notice Board</span>
                      </Link>

                      <Link 
                        to="/campus-connect" 
                        className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                      >
                        <GraduationCap size={24} />
                        <span className="font-bold">Campus Connect</span>
                      </Link>

                      {profile.role === "student" && (
                        <>
                          <Link 
                            to="/create-event" 
                            className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                          >
                            <PlusCircle size={24} />
                            <span className="font-bold">Host Event</span>
                          </Link>
                          <Link 
                            to="/my-registrations" 
                            className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                          >
                            <Ticket size={24} />
                            <span className="font-bold">My Tickets</span>
                          </Link>
                          <Link 
                            to="/my-events" 
                            className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                          >
                            <ListChecks size={24} />
                            <span className="font-bold">My Events</span>
                          </Link>
                        </>
                      )}

                      {profile.role === "management" && (
                        <Link 
                          to="/management" 
                          className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                        >
                          <ShieldCheck size={24} />
                          <span className="font-bold">Management</span>
                        </Link>
                      )}

                      <Link 
                        to="/account" 
                        className="flex items-center gap-4 p-4 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all"
                      >
                        <User size={24} />
                        <span className="font-bold">Account Settings</span>
                      </Link>
                    </>
                  )}

                  <div className="my-4 border-t border-zinc-100 pt-4">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-4 p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    >
                      <LogOut size={24} />
                      <span className="font-bold">Logout</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <Link 
                    to="/login" 
                    className="w-full py-4 text-center font-bold text-zinc-900 border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all"
                  >
                    Login
                  </Link>
                  <Link 
                    to="/login" 
                    className="w-full py-4 text-center font-bold bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}