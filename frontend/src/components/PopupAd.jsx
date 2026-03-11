import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

export default function PopupAd({ user, profile }) {
  const [ads, setAds] = useState([]);
  const [ad, setAd] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [imageOrientation, setImageOrientation] = useState("landscape");
  const location = useLocation();

  const isCheckingRef = useRef(false);
  const prevUserRef = useRef(user);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setImageOrientation(naturalWidth > naturalHeight ? "landscape" : "portrait");
  };

  // 1. AUTO-CLEANUP: If user logs out, clear all session storage automatically
  useEffect(() => {
    if (prevUserRef.current && !user) {
      sessionStorage.removeItem("lastAdShownUser");
      sessionStorage.removeItem("localLastShownTimestamp");
      sessionStorage.removeItem("localLastShownAdId");
    }
    prevUserRef.current = user;
  }, [user]);

  // 2. Fetch and filter eligible ads ONLY once (or when profile changes)
  useEffect(() => {
    const fetchAdsAndStrategy = async () => {
      if (!profile) return;

      // Fetch Strategy
      const strategyDoc = await getDoc(doc(db, "settings", "ads"));
      const strategy = strategyDoc.exists() ? strategyDoc.data().strategy : "round-robin";

      // Ordered 'asc' to ensure Ad1 -> Ad2 -> Ad3 flow
      const q = query(collection(db, "advertisements"), orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);

      const eligibleAds = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(adData => {
          const target = adData.targetAudience || "all";
          const targetDept = adData.targetDepartment || "all";
          const roleMatches = target === "all" || target === profile.role;
          const deptMatches = targetDept === "all" || targetDept === profile.department;
          return roleMatches && deptMatches;
        });

      setAds(eligibleAds);
      sessionStorage.setItem("adDisplayStrategy", strategy);
    };

    fetchAdsAndStrategy();
  }, [profile]);

  // 3. Handle Display Logic (Login & 15 Minute intervals with Zero-Cost Firestore optimization)
  useEffect(() => {
    const isAuthPage = location.pathname === "/login" || location.pathname === "/";
    const hasProfileAndPolicy = user && profile && profile.policyAccepted === true;

    if (!hasProfileAndPolicy || isAuthPage || ads.length === 0 || isOpen) {
      return;
    }

    const checkAndShowAd = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const now = Date.now();
        const FIFTEEN_MINUTES = 15 * 60 * 1000;
        const strategy = sessionStorage.getItem("adDisplayStrategy") || "round-robin";

        // Pull cached values from session storage to save DB reads
        const lastAdShownUser = sessionStorage.getItem("lastAdShownUser");
        let localLastShownTimestamp = parseInt(sessionStorage.getItem("localLastShownTimestamp") || "0");
        let localLastShownAdId = sessionStorage.getItem("localLastShownAdId") || null;

        let shouldShow = false;
        let adIdToUseAsPrevious = null;
        let isFreshLogin = false;

        // Rule 1: First time this specific user is logging in during this session
        if (lastAdShownUser !== user.uid) {
          // It's a fresh login. Fetch from DB to know where they left off previously.
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const userData = userDoc.data();

          adIdToUseAsPrevious = userData?.lastShownAdId || null;
          shouldShow = true;
          isFreshLogin = true;
        }
        // Rule 2: 15 minutes have passed since the last ad was shown
        else if (now - localLastShownTimestamp >= FIFTEEN_MINUTES) {
          adIdToUseAsPrevious = localLastShownAdId;
          shouldShow = true;
        }

        if (shouldShow) {
          let adToShow = null;

          if (strategy === "priority") {
            // Always show highest priority ad
            adToShow = [...ads].sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
          } else if (strategy === "hybrid" && isFreshLogin) {
            // On login, show highest priority ad
            adToShow = [...ads].sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
          } else {
            // Round Robin (default or hybrid fallback)
            const currentIndex = adIdToUseAsPrevious ? ads.findIndex(a => a.id === adIdToUseAsPrevious) : -1;
            const nextIndex = (currentIndex + 1) % ads.length;
            adToShow = ads[nextIndex];
          }

          if (adToShow) {
            // Update State
            setAd(adToShow);
            setIsOpen(true);

            // Lock the session to this user ID & update local memory
            sessionStorage.setItem("lastAdShownUser", user.uid);
            sessionStorage.setItem("localLastShownTimestamp", now.toString());
            sessionStorage.setItem("localLastShownAdId", adToShow.id);

            // Update Database ONLY when we actually show an ad
            await updateDoc(doc(db, "users", user.uid), {
              lastShownAdId: adToShow.id,
              lastShownTimestamp: now
            });
          }
        }
      } catch (error) {
        console.error("Error evaluating ad cycle:", error);
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Run immediately on mount/update
    checkAndShowAd();

    // Actively check every 1 minute if the 15-minute threshold has been reached
    const intervalId = setInterval(checkAndShowAd, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [ads, user, profile, location.pathname, isOpen]);

  // 4. AUTO-CLOSE LOGIC: Close the ad after 5 seconds
  useEffect(() => {
    let timeoutId;

    if (isOpen) {
      timeoutId = setTimeout(() => {
        setIsOpen(false);
      }, 5000); // 5000 milliseconds = 5 seconds
    }

    // Cleanup function: clears the timer if the component unmounts 
    // or if the user clicks the "X" button manually before 5 seconds are up
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && ad && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-xl overflow-y-auto">
          {ad.url ? (
            <a
              href={ad.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-4xl block cursor-pointer"
              onClick={handleClose}
            >
              <AdContent ad={ad} handleClose={handleClose} imageOrientation={imageOrientation} />
            </a>
          ) : (
            <div className="w-full max-w-4xl">
              <AdContent ad={ad} handleClose={handleClose} imageOrientation={imageOrientation} />
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}

function AdContent({ ad, handleClose, imageOrientation }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 40 }}
      className={cn(
        "relative bg-white rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 transition-all duration-500 my-auto",
        imageOrientation === "portrait" ? "max-w-4xl w-full" : "max-w-2xl w-full"
      )}
    >
      <button
        onClick={(e) => { e.preventDefault(); handleClose(); }}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-all"
      >
        <X size={20} className="sm:w-6 sm:h-6" />
      </button>

      <div className={cn(
        "flex flex-col",
        imageOrientation === "portrait" && ad.imageUrl ? "md:flex-row" : "flex-col"
      )}>
        {ad.imageUrl && (
          <div className={cn(
            "relative bg-zinc-900 flex items-center justify-center overflow-hidden group shrink-0",
            imageOrientation === "portrait" ? "w-full md:w-1/2 h-[40vh] md:h-[70vh]" : "w-full h-[30vh] sm:h-[40vh] md:h-[50vh]"
          )}>
            <img
              src={ad.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110"
              referrerPolicy="no-referrer"
            />
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className={cn(
                "relative z-10 w-full h-full shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]",
                imageOrientation === "portrait" ? "object-cover" : "object-contain"
              )}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent" />

            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-8 z-30">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/10 text-white text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] backdrop-blur-md border border-white/20 shadow-xl">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                Campus Update
              </div>
            </div>
          </div>
        )}
        <div className={cn(
          "p-6 sm:p-8 md:p-12 text-center bg-white relative flex flex-col justify-center",
          imageOrientation === "portrait" && ad.imageUrl ? "w-full md:w-1/2" : "w-full"
        )}>
          <div className="max-w-xl mx-auto w-full">
            <h2 className={cn(
              "font-serif font-bold text-zinc-900 mb-4 sm:mb-6 tracking-tight leading-[1.1]",
              imageOrientation === "portrait" ? "text-2xl sm:text-3xl md:text-4xl" : "text-3xl sm:text-4xl md:text-5xl"
            )}>
              {ad.title}
            </h2>
            <div className="w-12 sm:w-16 h-1 sm:h-1.5 bg-zinc-900 mx-auto mb-6 sm:mb-8 rounded-full" />
            <p className={cn(
              "text-zinc-500 leading-relaxed mb-8 sm:mb-10 font-medium italic",
              imageOrientation === "portrait" ? "text-base sm:text-lg" : "text-lg sm:text-xl"
            )}>
              "{ad.message}"
            </p>
            <div
              className="group relative w-full py-4 sm:py-5 bg-zinc-900 text-white font-bold rounded-xl sm:rounded-[1.5rem] overflow-hidden transition-all hover:shadow-[0_10px_30px_rgba(0,0,0,0.2)] active:scale-[0.98]"
            >
              <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg">
                CLICK HERE TO KNOW MORE
                <motion.span
                  animate={{ x: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  →
                </motion.span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-800 to-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}