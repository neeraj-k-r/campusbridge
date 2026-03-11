import { useEffect, useState } from "react";
import { collection, query, where, updateDoc, doc, onSnapshot, setDoc, deleteDoc, getDoc, addDoc, orderBy, serverTimestamp, increment } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase";
import ImageCropper from "../components/ImageCropper";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, Clock, Calendar, User, Eye, Loader2, Plus, Trash2, Sparkles, Users, ShieldCheck, Edit2, Megaphone, Image as ImageIcon, Send, GraduationCap, Search } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { useNotifications } from "../context/NotificationContext";

// Cloudinary Config
const CLOUDINARY_CLOUD_NAME = "dbyraj0xm";
const CLOUDINARY_UPLOAD_PRESET = "campus_posters";

export default function Management({ profile }) {
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingManagers, setPendingManagers] = useState([]);
  const [capacities, setCapacities] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [managerToReject, setManagerToReject] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, capacity: null, userToDelete: null, email: profile?.email || "", password: "", error: "", loading: false });
  const { sendNotification } = useNotifications();

  const [newDept, setNewDept] = useState("CSE");
  const [customDept, setCustomDept] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newTotal, setNewTotal] = useState("");
  const [editingCapacity, setEditingCapacity] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [capacityType, setCapacityType] = useState("student");
  const [expandedCapacityId, setExpandedCapacityId] = useState(null);

  // Ad Form State
  const [adTitle, setAdTitle] = useState("");
  const [adMessage, setAdMessage] = useState("");
  const [adUrl, setAdUrl] = useState("");
  const [adImageFile, setAdImageFile] = useState(null);
  const [adImagePreview, setAdImagePreview] = useState(null);
  const [adTargetAudience, setAdTargetAudience] = useState("all");
  const [adTargetDepartment, setAdTargetDepartment] = useState("all");
  const [adPriority, setAdPriority] = useState(1);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [adDisplayStrategy, setAdDisplayStrategy] = useState("round-robin");
  const [strategyLoading, setStrategyLoading] = useState(false);

  const isDeveloper = profile?.email?.toLowerCase() === "campusbridgeofficials@gmail.com";

  useEffect(() => {
    if (!profile) return;

    // Reset form when editing is canceled
    if (!editingCapacity) {
      setNewDept("CSE");
      setCustomDept("");
      setNewYear(new Date().getFullYear().toString());
      setNewTotal("");
    }
  }, [editingCapacity, profile]);

  useEffect(() => {
    if (!profile) return;

    const qEvents = query(
      collection(db, "events"),
      where("status", "==", "pending")
    );

    const unsubscribeEvents = onSnapshot(qEvents,
      (querySnapshot) => {
        const eventsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPendingEvents(eventsData);
      },
      (error) => {
        console.error("Events listener error:", error);
      }
    );

    const qCap = collection(db, "departmentCapacity");
    const unsubscribeCap = onSnapshot(qCap,
      (querySnapshot) => {
        const capData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCapacities(capData);
        setLoading(false);
      },
      (error) => {
        console.error("Capacity listener error:", error);
        setLoading(false);
      }
    );

    const qUsers = query(collection(db, "users"), where("role", "in", ["student", "faculty", "alumni"]));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    let unsubscribeManagers = () => { };
    if (profile?.role === "management") {
      const qManagers = query(
        collection(db, "users"),
        where("role", "in", ["management", "faculty"]),
        where("isApproved", "==", false)
      );
      unsubscribeManagers = onSnapshot(qManagers, (snapshot) => {
        setPendingManagers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Listen for advertisements
      const qAds = query(collection(db, "advertisements"), orderBy("createdAt", "desc"));
      const unsubscribeAds = onSnapshot(qAds, (snapshot) => {
        setAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Listen for ad strategy
      const unsubscribeStrategy = onSnapshot(doc(db, "settings", "ads"), (docSnap) => {
        if (docSnap.exists()) {
          setAdDisplayStrategy(docSnap.data().strategy || "round-robin");
        }
      });

      return () => {
        unsubscribeEvents();
        unsubscribeCap();
        unsubscribeUsers();
        unsubscribeManagers();
        unsubscribeAds();
        unsubscribeStrategy();
      };
    }

    return () => {
      unsubscribeEvents();
      unsubscribeCap();
      unsubscribeUsers();
      unsubscribeManagers();
    };
  }, [profile]);

  const handleAdFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleCropComplete = (file, previewUrl) => {
    setAdImageFile(file);
    setAdImagePreview(previewUrl);
    setShowCropper(false);
    setTempImage(null);
  };

  const handleAdSubmit = async (e) => {
    e.preventDefault();
    if (!adTitle.trim() || !adMessage.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setAdLoading(true);
    try {
      let imageUrl = "";
      if (adImageFile) {
        const uploadData = new FormData();
        uploadData.append("file", adImageFile);
        uploadData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: "POST",
            body: uploadData,
          }
        );

        const uploadedJson = await uploadResponse.json();
        if (uploadedJson.secure_url) {
          imageUrl = uploadedJson.secure_url;
        } else {
          throw new Error("Image upload failed");
        }
      }

      await addDoc(collection(db, "advertisements"), {
        title: adTitle,
        message: adMessage,
        url: adUrl,
        imageUrl,
        targetAudience: adTargetAudience,
        targetDepartment: adTargetDepartment,
        priority: parseInt(adPriority) || 1,
        createdAt: serverTimestamp(),
        createdBy: profile.email
      });

      toast.success("Advertisement created successfully!");
      setAdTitle("");
      setAdMessage("");
      setAdUrl("");
      setAdImageFile(null);
      setAdImagePreview(null);
      setAdTargetAudience("all");
      setAdTargetDepartment("all");
      setAdPriority(1);
    } catch (error) {
      console.error("Ad creation error:", error);
      toast.error("Failed to create advertisement");
    } finally {
      setAdLoading(false);
    }
  };

  const handleDeleteAd = async (adId) => {
    try {
      await deleteDoc(doc(db, "advertisements", adId));
      toast.success("Advertisement deleted");
    } catch (error) {
      console.error("Ad deletion error:", error);
      toast.error("Failed to delete advertisement");
    }
  };

  const handleUpdateAdStrategy = async (strategy) => {
    setStrategyLoading(true);
    try {
      await setDoc(doc(db, "settings", "ads"), { strategy }, { merge: true });
      setAdDisplayStrategy(strategy);
      toast.success(`Ad strategy updated to ${strategy}`);
    } catch (error) {
      console.error("Strategy update error:", error);
      toast.error("Failed to update ad strategy");
    } finally {
      setStrategyLoading(false);
    }
  };

  const syncCapacities = async () => {
    setLoading(true);
    try {
      for (const cap of capacities) {
        let actualCount = 0;
        if (cap.type === "faculty") {
          actualCount = allUsers.filter(u => u.role === "faculty" && u.department === cap.department).length;
        } else {
          actualCount = allUsers.filter(u =>
            u.role === "student" &&
            u.department === cap.department &&
            u.yearOfJoin?.toString() === cap.yearOfJoin?.toString()
          ).length;
        }

        if (actualCount !== (cap.registeredCount || 0)) {
          await updateDoc(doc(db, "departmentCapacity", cap.id), { registeredCount: actualCount });
        }
      }
      toast.success("Capacities synced successfully!");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync capacities.");
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER FOR SAFE DATE FORMATTING ---
  const safeFormatDate = (dateValue, formatStr = "MMM d, yyyy") => {
    try {
      if (!dateValue) return "Date Pending";
      const dateObj = new Date(dateValue);
      if (isNaN(dateObj.getTime())) return "Invalid Date";
      return format(dateObj, formatStr);
    } catch (e) {
      return "Date Error";
    }
  };

  const handleAddCapacity = async (e) => {
    e.preventDefault();
    const dept = newDept === "CUSTOM" ? customDept.toUpperCase() : newDept;
    if (!dept) return;
    const id = capacityType === "student" ? `${dept}_${newYear}` : `${dept}_FACULTY`;
    try {
      const docRef = doc(db, "departmentCapacity", id);
      const deletedDocRef = doc(db, "deletedCapacities", id);

      let registeredCount = 0;

      // Check if it was deleted
      const deletedDocSnap = await getDoc(deletedDocRef);
      if (deletedDocSnap.exists()) {
        registeredCount = deletedDocSnap.data().registeredCount || 0;
        await deleteDoc(deletedDocRef); // Remove from deleted
      } else {
        // Check if it already exists
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          registeredCount = docSnap.data().registeredCount || 0;
        }
      }

      await setDoc(docRef, {
        department: dept,
        yearOfJoin: capacityType === "student" ? newYear : "FACULTY",
        totalStudents: parseInt(newTotal),
        registeredCount: registeredCount,
        type: capacityType
      });
      toast.success("Capacity added/updated!");
      setNewTotal("");
      setCustomDept("");
      setEditingCapacity(null);
    } catch (error) {
      toast.error("Failed to add/update capacity.");
    }
  };

  const handlePasswordConfirm = async (e) => {
    e.preventDefault();
    setPasswordModal(prev => ({ ...prev, loading: true, error: "" }));

    try {
      // Authenticate the user with Firebase using the provided email and password
      await signInWithEmailAndPassword(auth, passwordModal.email, passwordModal.password);

      // Secret is correct, proceed with action
      if (passwordModal.action === "end_batch") {
        await executeEndBatch(passwordModal.capacity);
      } else if (passwordModal.action === "delete_capacity") {
        await executeDeleteCapacity(passwordModal.capacity);
      } else if (passwordModal.action === "delete_user") {
        await executeDeleteUser(passwordModal.userToDelete);
      }

      setPasswordModal({ isOpen: false, action: null, capacity: null, userToDelete: null, email: profile?.email || "", password: "", error: "", loading: false });
    } catch (error) {
      console.error("Authentication failed:", error);
      setPasswordModal(prev => ({ ...prev, error: "Invalid email or password", loading: false }));
    }
  };

  const executeDeleteUser = async (userToDelete) => {
    console.log("Executing delete user for:", userToDelete);
    if (!userToDelete?.id) {
      toast.error("User ID is missing");
      return;
    }

    try {
      // 1. Delete the user document from Firestore
      await deleteDoc(doc(db, "users", userToDelete.id));

      // 2. Clean up IDs so they can be reused if necessary (Safely checking roles)
      if (userToDelete.role === "student" && userToDelete.studentId) {
        await deleteDoc(doc(db, "studentIds", userToDelete.studentId));
      }
      if (userToDelete.role === "faculty" && userToDelete.facultyId) {
        await deleteDoc(doc(db, "facultyIds", userToDelete.facultyId));
      }

      // 3. Decrement the Active Configuration Capacity
      try {
        const isFaculty = userToDelete.role === "faculty";
        if (userToDelete.department && (isFaculty || userToDelete.yearOfJoin)) {
          // Construct the ID for the capacity document
          const capId = isFaculty
            ? `${userToDelete.department}_FACULTY`
            : `${userToDelete.department}_${userToDelete.yearOfJoin}`;

          const capRef = doc(db, "departmentCapacity", capId);
          const capSnap = await getDoc(capRef);

          // If the capacity document exists and count > 0, decrease it by 1
          if (capSnap.exists() && capSnap.data().registeredCount > 0) {
            await updateDoc(capRef, {
              registeredCount: increment(-1)
            });
          }
        }
      } catch (capError) {
        console.error("Failed to update capacity count:", capError);
      }

      toast.success(`User ${userToDelete.displayName} deleted successfully.`);
    } catch (error) {
      console.error("Delete user error:", error);
      toast.error("Failed to delete user: " + error.message);
    }
  };

  const executeEndBatch = async (cap) => {
    try {
      // Find all users in this capacity
      const usersToUpdate = allUsers.filter(u =>
        u.role === "student" &&
        u.department === cap.department &&
        u.yearOfJoin?.toString() === cap.yearOfJoin?.toString()
      );

      // Update all users to role: "alumni"
      const updatePromises = usersToUpdate.map(u =>
        updateDoc(doc(db, "users", u.id), { role: "alumni" })
      );
      await Promise.all(updatePromises);

      // Delete the capacity
      await deleteDoc(doc(db, "departmentCapacity", cap.id));

      toast.success(`Batch ${cap.department} ${cap.yearOfJoin} ended successfully. Users moved to Alumni.`);
    } catch (error) {
      console.error("End batch error:", error);
      toast.error("Failed to end batch");
    }
  };

  const executeDeleteCapacity = async (cap) => {
    try {
      // Find all users in this capacity
      const isFaculty = cap.type === "faculty";
      const usersToDelete = allUsers.filter(u => {
        if (isFaculty) {
          return u.role === "faculty" && u.department === cap.department;
        }
        return u.role === "student" &&
          u.department === cap.department &&
          u.yearOfJoin?.toString() === cap.yearOfJoin?.toString();
      });

      // Delete all users from Firestore
      const deletePromises = usersToDelete.map(async (u) => {
        await deleteDoc(doc(db, "users", u.id));
        if (u.role === "student" && u.studentId) {
          await deleteDoc(doc(db, "studentIds", u.studentId));
        }
        if (u.role === "faculty" && u.facultyId) {
          await deleteDoc(doc(db, "facultyIds", u.facultyId));
        }
      });
      await Promise.all(deletePromises);

      // Delete the capacity
      await deleteDoc(doc(db, "departmentCapacity", cap.id));

      toast.success(`Capacity deleted and ${usersToDelete.length} users removed.`);
    } catch (error) {
      console.error("Delete capacity error:", error);
      toast.error("Failed to delete capacity");
    }
  };

  const handleDeleteCapacity = async (id) => {
    if (!isDeveloper) {
      toast.error("Only developers can delete capacities.");
      return;
    }
    const cap = capacities.find(c => c.id === id);
    if (cap) {
      setPasswordModal({ isOpen: true, action: "delete_capacity", capacity: cap, email: profile?.email || "", password: "", error: "", loading: false });
    }
    setConfirmingDeleteId(null);
  };

  const handleStatusUpdate = async (eventId, status) => {
    if (status === "rejected") {
      setSelectedEventId(eventId);
      setRejectModalOpen(true);
      return;
    }

    setProcessing(eventId);
    try {
      await updateDoc(doc(db, "events", eventId), { status });

      // Notify the event host
      const event = pendingEvents.find(e => e.id === eventId);
      if (event) {
        if (event.hostId) {
          await sendNotification({
            title: `Event ${status === "approved" ? "Approved" : "Rejected"}`,
            message: `Your event "${event.title}" has been ${status}.`,
            link: `/my-events`,
            recipients: [event.hostId],
            type: "EVENT"
          });
        }

        // If approved, notify all students AND management
        if (status === "approved") {
          // Notify Students
          await sendNotification({
            title: "New Event Announced!",
            message: `"${event.title}" is now open for registration. Check it out!`,
            link: `/event/${eventId}`,
            recipients: ["role_student"],
            type: "EVENT"
          });

          // Notify Management (Self-notification for confirmation)
          await sendNotification({
            title: "Event Approved",
            message: `You successfully approved "${event.title}".`,
            link: `/event/${eventId}`,
            recipients: ["role_management"],
            type: "INFO"
          });
        }
      }

      toast.success(`Event ${status === "approved" ? "approved" : "rejected"} successfully!`);
    } catch (error) {
      console.error("Status update error:", error);
      toast.error("Failed to update event status.");
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveManager = async (managerId) => {
    setProcessing(managerId);
    try {
      const userToApprove = pendingManagers.find(m => m.id === managerId);
      const isFaculty = userToApprove?.role === "faculty";

      await updateDoc(doc(db, "users", managerId), { isApproved: true });

      // Notify the user
      await sendNotification({
        title: "Account Approved",
        message: `Your ${isFaculty ? "faculty" : "management"} account has been approved. You now have full access.`,
        link: isFaculty ? "/dashboard" : "/management",
        recipients: [managerId],
        type: "SYSTEM"
      });

      toast.success(`${isFaculty ? "Faculty" : "Manager"} account approved!`);
    } catch (error) {
      console.error("Approve error:", error);
      toast.error("Failed to approve account: " + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectManager = async () => {
    if (!managerToReject) return;
    setProcessing(managerToReject);
    try {
      await updateDoc(doc(db, "users", managerToReject), { isApproved: "rejected" });
      toast.success("Manager request rejected.");
      setManagerToReject(null);
    } catch (error) {
      console.error("Reject manager error:", error);
      toast.error("Failed to reject manager: " + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const confirmRejection = async () => {
    if (!selectedEventId || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }

    setProcessing(selectedEventId);
    try {
      await updateDoc(doc(db, "events", selectedEventId), {
        status: "rejected",
        rejectionReason: rejectionReason.trim()
      });

      // Notify the event host
      const event = pendingEvents.find(e => e.id === selectedEventId);
      if (event && event.hostId) {
        await sendNotification({
          title: "Event Rejected",
          message: `Your event "${event.title}" has been rejected. Reason: ${rejectionReason.trim()}`,
          link: `/my-events`,
          recipients: [event.hostId],
          type: "EVENT"
        });
      }

      toast.success("Event rejected successfully!");
      setRejectModalOpen(false);
      setRejectionReason("");
      setSelectedEventId(null);
    } catch (error) {
      console.error("Status update error:", error);
      toast.error("Failed to reject event.");
    } finally {
      setProcessing(null);
    }
  };

  const totalCapacity = capacities.reduce((acc, curr) => acc + (curr.totalStudents || 0), 0);
  const totalRegistered = capacities.reduce((acc, curr) => acc + (curr.registeredCount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-zinc-900" size={32} />
          <p className="text-zinc-500 font-medium animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {showCropper && (
        <ImageCropper
          image={tempImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setTempImage(null);
          }}
          aspectRatio={16 / 9}
        />
      )}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-100">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={12} className="text-emerald-500" />
            <span>Admin Control Center</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-zinc-900 mb-2">Management Dashboard</h1>
          <p className="text-zinc-500 text-lg">Overview of campus events and student capacities.</p>
        </div>
        <div className="flex flex-wrap gap-4 pb-4 md:pb-0">
          {isDeveloper && (
            <button
              onClick={syncCapacities}
              disabled={loading}
              className="bg-zinc-900 text-white px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Sync Counts"}
            </button>
          )}
          {profile.email === "campusbridgeofficials@gmail.com" && (
            <div className="bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-100 text-center min-w-[100px] shrink-0">
              <div className="text-2xl font-bold text-emerald-600 mb-1">{pendingManagers.length}</div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Pending Mgrs</div>
            </div>
          )}
          <div className="bg-zinc-50 px-4 py-3 rounded-2xl border border-zinc-100 text-center min-w-[80px] shrink-0">
            <div className="text-2xl font-bold text-zinc-900 mb-1">{pendingEvents.length}</div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pending</div>
          </div>
          <div className="bg-zinc-50 px-4 py-3 rounded-2xl border border-zinc-100 text-center min-w-[80px] shrink-0">
            <div className="text-2xl font-bold text-zinc-900 mb-1">{capacities.length}</div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Depts</div>
          </div>
          <div className="bg-zinc-50 px-4 py-3 rounded-2xl border border-zinc-100 text-center min-w-[80px] shrink-0">
            <div className="text-2xl font-bold text-zinc-900 mb-1">{totalCapacity}</div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Capacity</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Pending Events & Managers */}
        <div className="lg:col-span-2 space-y-8">
          {profile?.role === "management" && pendingManagers.length > 0 && (
            <section className="bg-emerald-50/50 border border-emerald-100 rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={24} />
                  Pending Approvals
                </h2>
              </div>
              <div className="grid gap-4">
                {pendingManagers.map(user => (
                  <div key={user.id} className="bg-white p-6 rounded-2xl border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-xl">
                        {user.displayName?.[0] || "U"}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900 uppercase">{user.displayName}</h4>
                        <p className="text-sm text-zinc-500">{user.email} • <span className="capitalize">{user.email === "campusbridgeofficials@gmail.com" ? "developer" : user.role}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDeveloper && (
                        <button
                          onClick={() => setPasswordModal({
                            isOpen: true,
                            action: "delete_user",
                            userToDelete: user,
                            email: profile?.email || "",
                            password: "",
                            error: "",
                            loading: false
                          })}
                          className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete User Permanently"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                      <button
                        onClick={() => setManagerToReject(user.id)}
                        disabled={processing === user.id}
                        className="p-2.5 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-all"
                        title="Reject Request"
                      >
                        <XCircle size={20} />
                      </button>
                      <button
                        onClick={() => handleApproveManager(user.id)}
                        disabled={processing === user.id}
                        className="px-4 md:px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 min-w-[44px] flex items-center justify-center"
                      >
                        {processing === user.id ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <>
                            <CheckCircle2 size={18} className="md:hidden" />
                            <span className="hidden md:inline">Approve</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isDeveloper && (
            <section className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <Users className="text-zinc-400" size={24} />
                  User Directory
                </h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {allUsers
                  .filter(u => {
                    // FIX: Safely check IDs so the app doesn't crash when one is missing
                    const searchLower = userSearch.toLowerCase();
                    return (
                      (u.displayName || "").toLowerCase().includes(searchLower) ||
                      (u.email || "").toLowerCase().includes(searchLower) ||
                      (u.studentId || "").toLowerCase().includes(searchLower) ||
                      (u.facultyId || "").toLowerCase().includes(searchLower)
                    );
                  })
                  .map(u => (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100 group hover:border-emerald-200 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-400 shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            u.displayName?.[0] || "?"
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-zinc-900 uppercase truncate">{u.displayName}</h4>
                          <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                              u.role === "alumni" ? "bg-amber-100 text-amber-700" :
                                u.role === "faculty" ? "bg-purple-100 text-purple-700" :
                                  u.role === "management" ? "bg-red-100 text-red-700" :
                                    "bg-emerald-100 text-emerald-700"
                            )}>
                              {u.role}
                            </span>
                            {(u.studentId || u.facultyId) && (
                              <span className="text-[8px] text-zinc-400 font-mono">ID: {u.studentId || u.facultyId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setPasswordModal({
                          isOpen: true,
                          action: "delete_user",
                          userToDelete: u,
                          email: profile?.email || "",
                          password: "",
                          error: "",
                          loading: false
                        })}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                        title="Delete User Permanently"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                }

                {allUsers.length > 0 && allUsers.filter(u => {
                  const searchLower = userSearch.toLowerCase();
                  return (
                    (u.displayName || "").toLowerCase().includes(searchLower) ||
                    (u.email || "").toLowerCase().includes(searchLower) ||
                    (u.studentId || "").toLowerCase().includes(searchLower) ||
                    (u.facultyId || "").toLowerCase().includes(searchLower)
                  );
                }).length === 0 && (
                    <div className="col-span-2 py-12 text-center">
                      <p className="text-sm text-zinc-500">No users found matching "{userSearch}"</p>
                    </div>
                  )}
              </div>
            </section>
          )}

          {profile?.role === "management" && (
            <section className="bg-zinc-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-zinc-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                  <Megaphone className="text-emerald-400" size={24} />
                  Advertisement Management
                </h2>
                <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider border border-white/10 shrink-0 self-start sm:self-auto">
                  Management Only
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <form onSubmit={handleAdSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Ad Title</label>
                    <input
                      type="text"
                      value={adTitle}
                      onChange={(e) => setAdTitle(e.target.value)}
                      placeholder="e.g. Special Offer!"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Ad URL (Optional)</label>
                    <input
                      type="url"
                      value={adUrl}
                      onChange={(e) => setAdUrl(e.target.value)}
                      placeholder="e.g. https://example.com"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Target Audience</label>
                    <select
                      value={adTargetAudience}
                      onChange={(e) => setAdTargetAudience(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white [&>option]:text-zinc-900 transition-all"
                    >
                      <option value="all">All Users</option>
                      <option value="student">Students Only</option>
                      <option value="faculty">Faculty Only</option>
                      <option value="management">Management Only</option>
                    </select>
                  </div>
                  {(adTargetAudience === "student" || adTargetAudience === "faculty") && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Target Department</label>
                      <select
                        value={adTargetDepartment}
                        onChange={(e) => setAdTargetDepartment(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white [&>option]:text-zinc-900 transition-all"
                      >
                        <option value="all">All Departments</option>
                        {[...new Set(capacities.map(cap => cap.department))].sort().map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Ad Priority (Higher = Show First)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={adPriority}
                      onChange={(e) => setAdPriority(e.target.value)}
                      placeholder="1"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Ad Message</label>
                    <textarea
                      value={adMessage}
                      onChange={(e) => setAdMessage(e.target.value)}
                      placeholder="What should the popup say?"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600 transition-all min-h-[100px] resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Poster Image</label>
                    <label className="block w-full cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAdFileChange}
                        className="hidden"
                      />
                      <div className={cn(
                        "w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden relative min-h-[12rem]",
                        adImagePreview ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 group-hover:border-white/20 bg-white/5"
                      )}>
                        {adImagePreview ? (
                          <div className="w-full relative flex items-center justify-center bg-zinc-800 p-4">
                            <img
                              src={adImagePreview}
                              alt="Preview"
                              className="max-w-full max-h-[300px] object-contain relative z-10 shadow-2xl rounded-lg"
                            />
                            <img src={adImagePreview} alt="" className="absolute inset-0 w-full h-full object-cover blur-xl opacity-20" />
                            <div className="absolute top-4 right-4 z-20 flex gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setAdImageFile(null);
                                  setAdImagePreview(null);
                                }}
                                className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all backdrop-blur-md"
                              >
                                <XCircle size={20} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-8 text-center">
                            <ImageIcon size={32} className="text-zinc-600 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Upload Poster</span>
                            <span className="text-[10px] text-zinc-600 mt-2 block">Supports Portrait & Landscape</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={adLoading || !adTitle || !adMessage}
                    className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {adLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    Create Advertisement
                  </button>
                </form>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 ml-1">Ad Display Strategy</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: "round-robin", label: "Round Robin", desc: "Cycle through all ads equally" },
                        { id: "priority", label: "Priority Only", desc: "Always show highest priority ad" },
                        { id: "hybrid", label: "Hybrid (Login Priority)", desc: "Priority on login, then cycle" }
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleUpdateAdStrategy(s.id)}
                          disabled={strategyLoading}
                          className={cn(
                            "w-full p-4 rounded-2xl border text-left transition-all relative group",
                            adDisplayStrategy === s.id
                              ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                              : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm">{s.label}</span>
                            {adDisplayStrategy === s.id && <CheckCircle2 size={16} className="text-emerald-400" />}
                          </div>
                          <p className="text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Active Advertisements</label>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {ads.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-zinc-500 text-sm">No active advertisements</p>
                        </div>
                      ) : (
                        ads.map(ad => (
                          <div key={ad.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group">
                            {ad.imageUrl && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-zinc-800 flex items-center justify-center relative">
                                <img src={ad.imageUrl} alt="" className="w-full h-full object-contain relative z-10" />
                                <img src={ad.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm opacity-30" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-bold text-sm truncate">{ad.title}</h4>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">P{ad.priority || 1}</span>
                              </div>
                              <p className="text-xs text-zinc-500 truncate mb-1">{ad.message}</p>
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-zinc-300">
                                Target: {ad.targetAudience === "all" ? "All Users" : ad.targetAudience}
                                {ad.targetAudience !== "all" && ad.targetAudience !== "management" && ad.targetDepartment && ad.targetDepartment !== "all" && ` (${ad.targetDepartment})`}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteAd(ad.id)}
                              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                <Clock className="text-amber-500" size={24} />
                Pending Approvals
              </h2>
              <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-100">
                {pendingEvents.length} Requests
              </span>
            </div>

            {pendingEvents.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center shadow-sm">
                <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                  <CheckCircle2 className="text-emerald-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">All caught up!</h3>
                <p className="text-zinc-500 max-w-xs mx-auto">
                  There are no pending event requests at the moment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {pendingEvents.map((event) => (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex flex-col md:flex-row">
                        <div className="w-full md:w-48 h-48 md:h-auto relative overflow-hidden bg-zinc-100">
                          <img
                            src={event.posterUrl}
                            alt={event.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                        </div>
                        <div className="flex-1 p-4 md:p-8 flex flex-col">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-zinc-900 mb-2 line-clamp-1">{event.title}</h3>
                              <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={14} />
                                  <span>{safeFormatDate(event.date)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <User size={14} />
                                  <span className="uppercase">{event.hostName || "Unknown Host"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-xs font-bold text-zinc-400 bg-zinc-50 px-2 py-1 rounded uppercase tracking-wider">
                              {safeFormatDate(event.createdAt, "MMM d")}
                            </div>
                          </div>

                          <div className="mt-auto pt-6 border-t border-zinc-100 flex flex-wrap gap-3">
                            <Link
                              to={`/event/${event.id}`}
                              className="px-3 md:px-4 py-2 rounded-xl bg-zinc-50 text-zinc-600 text-sm font-bold hover:bg-zinc-100 transition-all flex items-center gap-2 min-w-[44px] justify-center"
                            >
                              <Eye size={16} />
                              <span className="hidden md:inline">Details</span>
                              <span className="md:hidden">D</span>
                            </Link>
                            <div className="flex-1" />
                            <button
                              onClick={() => handleStatusUpdate(event.id, "rejected")}
                              disabled={!!processing}
                              className="px-3 md:px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 min-w-[44px] justify-center"
                            >
                              <XCircle size={16} />
                              <span className="hidden md:inline">Reject</span>
                              <span className="md:hidden">R</span>
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(event.id, "approved")}
                              disabled={!!processing}
                              className="px-3 md:px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-lg shadow-zinc-900/20 min-w-[44px] justify-center"
                            >
                              {processing === event.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <>
                                  <CheckCircle2 size={16} />
                                  <span className="hidden md:inline">Approve</span>
                                  <span className="md:hidden">A</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Capacity Management */}
        <div className="space-y-8">
          <section className="bg-zinc-900 rounded-3xl p-8 text-white shadow-xl shadow-zinc-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10">
              <Users className="text-emerald-400" size={20} />
              {editingCapacity ? "Update Capacity" : "Add Capacity"}
            </h2>

            <form onSubmit={handleAddCapacity} className="space-y-4 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Capacity Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCapacityType("student")}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                        capacityType === "student" ? "bg-emerald-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                      )}
                      disabled={!!editingCapacity}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setCapacityType("faculty")}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                        capacityType === "faculty" ? "bg-emerald-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                      )}
                      disabled={!!editingCapacity}
                    >
                      Faculty
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Department</label>
                  <div className="flex gap-2">
                    <select
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                      className="flex-1 px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white [&>option]:text-zinc-900"
                      disabled={!!editingCapacity}
                    >
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="ME">ME</option>
                      <option value="CE">CE</option>
                      <option value="EE">EE</option>
                      <option value="IT">IT</option>
                      <option value="CUSTOM">Custom...</option>
                    </select>
                  </div>
                </div>
                {newDept === "CUSTOM" && (
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Department Name"
                      value={customDept}
                      onChange={(e) => setCustomDept(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600"
                      required
                      disabled={!!editingCapacity}
                    />
                  </div>
                )}
                {capacityType === "student" && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Year</label>
                    <input
                      type="number"
                      placeholder="2024"
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600"
                      disabled={!!editingCapacity}
                    />
                  </div>
                )}
                <div className={cn(capacityType === "faculty" ? "col-span-2" : "")}>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Total {capacityType === "student" ? "Students" : "Faculty"}</label>
                  <input
                    type="number"
                    placeholder="60"
                    value={newTotal}
                    onChange={(e) => setNewTotal(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 mt-2"
              >
                <Plus size={18} /> Add Configuration
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <Users size={20} className="text-zinc-400" />
              Active Configurations
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {capacities.map(cap => {
                const isFaculty = cap.type === "faculty";
                const usersInDept = allUsers
                  .filter(u => {
                    if (isFaculty) {
                      return u.role === "faculty" && u.department === cap.department;
                    }
                    return u.role === "student" &&
                      u.department === cap.department &&
                      u.yearOfJoin?.toString() === cap.yearOfJoin?.toString();
                  })
                  .sort((a, b) => {
                    if (isFaculty) return (a.displayName || "").localeCompare(b.displayName || "");
                    return (a.studentId || "").localeCompare(b.studentId || "");
                  });
                const isExpanded = expandedCapacityId === cap.id;

                return (
                  <div key={cap.id} className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:border-zinc-300 transition-all shadow-sm">
                    <div className="p-4 flex justify-between items-center">
                      <div className="w-full pr-4 min-w-0 cursor-pointer" onClick={() => setExpandedCapacityId(isExpanded ? null : cap.id)}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            isFaculty ? "bg-purple-100 text-purple-600" : "bg-emerald-100 text-emerald-600"
                          )}>
                            {isFaculty ? "Faculty" : "Student"}
                          </span>
                          <h3 className="font-bold text-zinc-900 truncate">{cap.department}</h3>
                          {!isFaculty && <span className="text-xs font-bold text-zinc-400">{cap.yearOfJoin}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all duration-500",
                                isFaculty ? "bg-purple-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, (cap.registeredCount / cap.totalStudents) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-zinc-500 shrink-0">
                            {cap.registeredCount} / {cap.totalStudents}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCapacity(cap);
                            setNewDept(cap.department);
                            setNewYear(cap.yearOfJoin);
                            setNewTotal(cap.totalStudents.toString());
                            setCapacityType(cap.type || "student");
                          }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-1.5 justify-center"
                          title="Edit Capacity"
                        >
                          <Edit2 size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline">Edit</span>
                        </button>
                        {isDeveloper && !isFaculty && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPasswordModal({ isOpen: true, action: "end_batch", capacity: cap, email: profile?.email || "", password: "", error: "", loading: false });
                            }}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all flex items-center gap-1.5 justify-center"
                            title="End Batch"
                          >
                            <GraduationCap size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline">End Batch</span>
                          </button>
                        )}
                        {isDeveloper && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPasswordModal({ isOpen: true, action: "delete_capacity", capacity: cap, email: profile?.email || "", password: "", error: "", loading: false });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1.5 justify-center"
                            title="Delete Capacity"
                          >
                            <Trash2 size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline">Delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden border-t border-zinc-100 bg-zinc-50/50"
                        >
                          <div className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {usersInDept.length === 0 ? (
                                <div className="col-span-2 py-4 text-center text-xs text-zinc-400 font-medium">
                                  No {isFaculty ? "faculty" : "students"} registered yet.
                                </div>
                              ) : (
                                usersInDept.map(user => (
                                  <div key={user.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-zinc-100 shadow-sm">
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-zinc-900 truncate uppercase">{user.displayName}</p>
                                      <p className="text-[10px] text-zinc-500 font-mono">{isFaculty ? (user.facultyId || "No ID") : (user.studentId || "No ID")}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                        isFaculty ? "text-purple-600 bg-purple-50" : "text-emerald-600 bg-emerald-50"
                                      )}>
                                        {isFaculty ? "FACULTY" : "STUDENT"}
                                      </div>
                                      {isDeveloper && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPasswordModal({
                                              isOpen: true,
                                              action: "delete_user",
                                              userToDelete: user,
                                              email: profile?.email || "",
                                              password: "",
                                              error: "",
                                              loading: false
                                            });
                                          }}
                                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                          title="Delete User"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {managerToReject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-4">Reject Request</h3>
              <p className="text-zinc-500 mb-6">Are you sure you want to reject this request? They will not be able to access the dashboard.</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setManagerToReject(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectManager}
                  disabled={!!processing}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                  Reject Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-4">Reject Event</h3>
              <p className="text-zinc-500 mb-6">Please provide a reason for rejecting this event. This will be visible to the host.</p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all min-h-[120px]"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                    setSelectedEventId(null);
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRejection}
                  disabled={!rejectionReason.trim() || !!processing}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {passwordModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">
                {passwordModal.action === "end_batch" ? "End Batch" :
                  passwordModal.action === "delete_capacity" ? "Delete Capacity" :
                    "Delete User"}
              </h3>
              <p className="text-zinc-500 mb-6 text-sm">
                {passwordModal.action === "end_batch"
                  ? `Are you sure you want to end the ${passwordModal.capacity?.department} ${passwordModal.capacity?.yearOfJoin} batch? All students in this batch will be marked as Alumni.`
                  : passwordModal.action === "delete_capacity"
                    ? `Are you sure you want to delete the ${passwordModal.capacity?.department} capacity? All associated users will be deleted.`
                    : `Are you sure you want to permanently delete user ${passwordModal.userToDelete?.displayName}? This action cannot be undone.`}
                <br /><br />
                Please verify your identity to confirm.
              </p>

              <form onSubmit={handlePasswordConfirm}>
                <input
                  type="email"
                  value={passwordModal.email}
                  onChange={(e) => setPasswordModal(prev => ({ ...prev, email: e.target.value, error: "" }))}
                  placeholder="Your Account Email"
                  className={cn(
                    "w-full p-4 bg-zinc-50 border rounded-xl mb-2 focus:outline-none focus:ring-2 transition-all",
                    passwordModal.error ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" : "border-zinc-200 focus:ring-emerald-500/20 focus:border-emerald-500"
                  )}
                  readOnly
                />
                <input
                  type="password"
                  value={passwordModal.password}
                  onChange={(e) => setPasswordModal(prev => ({ ...prev, password: e.target.value, error: "" }))}
                  placeholder="Your Account Password"
                  className={cn(
                    "w-full p-4 bg-zinc-50 border rounded-xl mb-2 focus:outline-none focus:ring-2 transition-all",
                    passwordModal.error ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" : "border-zinc-200 focus:ring-emerald-500/20 focus:border-emerald-500"
                  )}
                  autoFocus
                />
                {passwordModal.error && (
                  <p className="text-red-500 text-xs font-bold mb-4 ml-1">{passwordModal.error}</p>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setPasswordModal({ isOpen: false, action: null, capacity: null, userToDelete: null, email: profile?.email || "", password: "", error: "", loading: false })}
                    className="flex-1 py-3 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!passwordModal.email || !passwordModal.password || passwordModal.loading}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {passwordModal.loading ? <Loader2 className="animate-spin" size={18} /> : (
                      passwordModal.action === "end_batch" ? <GraduationCap size={18} /> :
                        <Trash2 size={18} />
                    )}
                    Confirm
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}