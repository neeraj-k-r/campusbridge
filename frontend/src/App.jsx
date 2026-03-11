import { useEffect, useState, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { Toaster, toast } from "react-hot-toast";
import { Clock, XCircle } from "lucide-react";
import { auth, db } from "./firebase";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateEvent from "./pages/CreateEvent";
import EventDetails from "./pages/EventDetails";
import Management from "./pages/Management";
import MyRegistrations from "./pages/MyRegistrations";
import MyEvents from "./pages/MyEvents";
import Account from "./pages/Account";
import Complaints from "./pages/Complaints";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NoticeBoard from "./pages/NoticeBoard";
import CampusConnect from "./pages/CampusConnect";
import Navbar from "./components/Navbar";
import PopupAd from "./components/PopupAd";

function AppContent({ user, profile, handleAcceptPolicy }) {
  const location = useLocation();
  const isLanding = location.pathname === "/";
  
  // Memoize Login component to prevent unmounting/state reset during auth flicker
  const loginElement = useMemo(() => <Login />, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Toaster position="top-right" />
      <PopupAd user={user} profile={profile} />
      <Navbar user={user} profile={profile} />
      <main className={!isLanding ? "container mx-auto px-4 py-8" : ""}>
        {user && !profile && location.pathname !== "/login" ? (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-zinc-100 text-center">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-red-600/10">
                <Clock size={40} />
              </div>
              <h1 className="text-3xl font-serif font-bold text-zinc-900 mb-4">Account Setup Incomplete</h1>
              <p className="text-zinc-500 leading-relaxed mb-8">
                Your account was created, but your profile setup failed. Please sign out and try signing up again.
              </p>
              <button 
                onClick={() => auth.signOut()}
                className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : user && profile && profile.policyAccepted !== true ? (
          <PrivacyPolicy onAccept={handleAcceptPolicy} />
        ) : user && profile && (profile.role === "management" || profile.role === "faculty") && profile.isApproved === "rejected" ? (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-zinc-100 text-center">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-red-600/10">
                <XCircle size={40} />
              </div>
              <h1 className="text-3xl font-serif font-bold text-zinc-900 mb-4">Account Rejected</h1>
              <p className="text-zinc-500 leading-relaxed mb-8">
                Your account request has been rejected by the administrator.
              </p>
              <button 
                onClick={() => auth.signOut()}
                className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : user && profile && (profile.role === "management" || profile.role === "faculty") && profile.isApproved === false ? (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-zinc-100 text-center">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-amber-600/10">
                <Clock size={40} />
              </div>
              <h1 className="text-3xl font-serif font-bold text-zinc-900 mb-4">Approval Pending</h1>
              <p className="text-zinc-500 leading-relaxed mb-8">
                Your account has been created successfully. For security reasons, an administrator must manually verify your credentials before you can access the dashboard.
              </p>
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-sm text-zinc-400 font-medium">
                Contact: <span className="text-zinc-900">campusbridgeofficials@gmail.com</span>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="mt-8 w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route 
              path="/login" 
              element={!user || !profile ? loginElement : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard profile={profile} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/create-event" 
              element={user && profile?.role === "student" ? <CreateEvent profile={profile} /> : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/event/:id" 
              element={user ? <EventDetails profile={profile} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/account" 
              element={user ? <Account profile={profile} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/management" 
              element={user && profile?.role === "management" ? <Management profile={profile} /> : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/my-registrations" 
              element={user && profile?.role === "student" ? <MyRegistrations profile={profile} /> : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/my-events" 
              element={user && profile?.role === "student" ? <MyEvents profile={profile} /> : <Navigate to="/dashboard" />} 
            />
            <Route 
              path="/complaints" 
              element={user ? <Complaints profile={profile} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/notices" 
              element={user ? <NoticeBoard profile={profile} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/campus-connect" 
              element={user ? <CampusConnect user={user} profile={profile} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/privacy" 
              element={<PrivacyPolicy hideAccept={true} />} 
            />
          </Routes>
        )}
      </main>
    </div>
  );
}

import { NotificationProvider } from "./context/NotificationContext";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleAcceptPolicy = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { policyAccepted: true });
      setProfile(prev => ({ ...prev, policyAccepted: true }));
      toast.success("Policy accepted. Welcome!");
    } catch (error) {
      console.error("Error accepting policy:", error);
      toast.error("Failed to accept policy: " + error.message);
    }
  };

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Listen to profile changes
        const docRef = doc(db, "users", firebaseUser.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
        unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  return (
    <Router>
      <NotificationProvider user={user} profile={profile}>
        <AppContent 
          user={user} 
          profile={profile} 
          handleAcceptPolicy={handleAcceptPolicy} 
        />
      </NotificationProvider>
    </Router>
  );
}
