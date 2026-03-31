import { useEffect, useState } from "react";
import { collection, query, where, updateDoc, doc, onSnapshot, setDoc, deleteDoc, getDoc, addDoc, orderBy, serverTimestamp } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase";
import ImageCropper from "../components/ImageCropper";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, Clock, Calendar, User, Eye, Loader2, Plus, Trash2, Sparkles, Users, ShieldCheck, Edit2, Megaphone, Image as ImageIcon, Send, GraduationCap, Search, Forward, AlertCircle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { useNotifications } from "../context/NotificationContext";

// Cloudinary Config
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dbyraj0xm";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "campus_posters";

const STAGE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 Hours

const getEffectiveStage = (event) => {
  if (event.status !== "pending") return event.status;
  const now = Date.now();
  const timeSpent = now - (event.stageUpdatedAt || event.createdAt);

  if (event.approvalStage === "tutor") {
    if (timeSpent > STAGE_TIMEOUT * 2) return "principal";
    if (timeSpent > STAGE_TIMEOUT) return "hod";
    return "tutor";
  }
  if (event.approvalStage === "hod") {
    if (timeSpent > STAGE_TIMEOUT) return "principal";
    return "hod";
  }
  return event.approvalStage || "principal";
};

export default function Management({ profile }) {
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingManagers, setPendingManagers] = useState([]);
  const [capacities, setCapacities] = useState([]);
  const [ads, setAds] = useState([]);
  // 🔥 NEW STATE: Verified Complaints from Panel 🔥
  const [verifiedComplaints, setVerifiedComplaints] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [managerToReject, setManagerToReject] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, capacity: null, userToDelete: null, password: "", developerPassword: "", error: "", loading: false });
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

  const userEmail = profile?.email?.toLowerCase() || "";
  const isDeveloper = userEmail === "campusbridgeofficials@gmail.com" || profile?.type === "developer";
  const isPrincipalEmail = userEmail === "principal@snmimt.edu.in";

  const hodDepartment = profile?.department?.toUpperCase() || profile?.email?.match(/^hod([a-z]+)@/i)?.[1]?.toUpperCase();

  const isHOD = profile?.type === "hod" ||
    (profile?.role === "management" && userEmail.startsWith("hod")) ||
    (profile?.role === "management" && !!hodDepartment && !isDeveloper && !isPrincipalEmail);

  const isManagementStaff = isPrincipalEmail || profile?.type === "manager" || profile?.type === "principal" || (profile?.role === "management" && !isHOD && !isDeveloper);
  const isPrincipal = isPrincipalEmail || profile?.type === "principal" || isDeveloper || (profile?.role === "management" && !isHOD);
  const hasManagementAccess = profile?.role === "management" || isDeveloper || isPrincipalEmail || isPrincipal;

  useEffect(() => {
    if (isHOD && hodDepartment && !editingCapacity) {
      setNewDept(hodDepartment);
    }
  }, [isHOD, hodDepartment, editingCapacity]);

  useEffect(() => {
    if (!profile) return;

    if (!editingCapacity) {
      setNewDept(isHOD && hodDepartment ? hodDepartment : "CSE");
      setCustomDept("");
      setNewYear(new Date().getFullYear().toString());
      setNewTotal("");
    }
  }, [editingCapacity, profile, isHOD, hodDepartment]);

  useEffect(() => {
    if (!profile) return;

    const qEvents = query(
      collection(db, "events"),
      where("status", "==", "pending")
    );

    const unsubscribeEvents = onSnapshot(qEvents,
      (querySnapshot) => {
        const eventsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPendingEvents(eventsData);
      },
      (error) => console.error("Events listener error:", error)
    );

    // 🔥 SMART COMPLAINT FETCHING: Catches Verified AND Auto-Escalated Complaints
    let unsubscribeComplaints = () => { };
    if (isPrincipal) {
      const qComplaints = query(collection(db, "complaints"), where("status", "in", ["pending", "verified"]));
      unsubscribeComplaints = onSnapshot(qComplaints, (snapshot) => {
        const COMPLAINT_TIMEOUT = 24 * 60 * 60 * 1000; // 24 Hours
        const now = Date.now();

        const validComplaints = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(c => {
          if (c.status === "verified") return true;
          if (c.status === "pending") {
            // Check if 24 hours have passed
            const createdTime = c.createdAt?.toMillis?.() || now;
            return (now - createdTime) > COMPLAINT_TIMEOUT;
          }
          return false;
        });

        // Sort by newest
        validComplaints.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setVerifiedComplaints(validComplaints);
      });
    }

    const qCap = collection(db, "departmentCapacity");
    const unsubscribeCap = onSnapshot(qCap,
      (querySnapshot) => {
        const capData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCapacities(capData);
        setLoading(false);
      },
      (error) => {
        console.error("Capacity listener error:", error);
        setLoading(false);
      }
    );

    let unsubscribeUsers = () => { };
    if (hasManagementAccess) {
      const qUsers = query(collection(db, "users"), where("role", "in", ["student", "faculty", "alumni", "management"]));
      unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    } else if (isHOD) {
      const qUsers = query(collection(db, "users"), where("role", "==", "faculty"));
      unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.department?.toUpperCase() === hodDepartment);
        setAllUsers(filtered);
      });
    }

    let unsubscribePendingUsers = () => { };
    let unsubscribeAds = () => { };
    let unsubscribeStrategy = () => { };

    if (hasManagementAccess || profile?.isTutor) {
      let qPending;

      if (hasManagementAccess) {
        qPending = query(
          collection(db, "users"),
          where("isApproved", "==", false)
        );
      } else if (profile?.isTutor) {
        qPending = query(
          collection(db, "users"),
          where("isApproved", "==", false),
          where("role", "==", "student"),
          where("department", "==", profile.department),
          where("yearOfJoin", "==", profile.tutorOf)
        );
      }

      if (qPending) {
        unsubscribePendingUsers = onSnapshot(qPending, (snapshot) => {
          const allPending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          let filteredPending = [];

          if (isDeveloper || isPrincipal) {
            filteredPending = allPending;
          } else if (isManagementStaff) {
            filteredPending = allPending.filter(u => u.role !== "student" && u.role !== "faculty");
          } else if (isHOD) {
            filteredPending = allPending.filter(u => {
              return u.role === "faculty" &&
                u.department &&
                hodDepartment &&
                u.department.toUpperCase() === hodDepartment;
            });

            if (profile?.isTutor) {
              const tutorStudents = allPending.filter(u =>
                u.role === "student" &&
                u.department?.toUpperCase() === hodDepartment &&
                u.yearOfJoin === profile.tutorOf
              );
              filteredPending = [...filteredPending, ...tutorStudents];
            }
          } else if (profile?.isTutor) {
            filteredPending = allPending.filter(u =>
              u.role === "student" &&
              u.department?.toUpperCase() === profile.department?.toUpperCase() &&
              u.yearOfJoin === profile.tutorOf
            );
          }
          setPendingManagers(filteredPending);
        });
      }

      if (isDeveloper) {
        const qAds = query(collection(db, "advertisements"), orderBy("createdAt", "desc"));
        unsubscribeAds = onSnapshot(qAds, (snapshot) => {
          setAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeStrategyDoc = onSnapshot(doc(db, "settings", "ads"), (docSnap) => {
          if (docSnap.exists()) {
            setAdDisplayStrategy(docSnap.data().strategy || "round-robin");
          }
        });
        unsubscribeStrategy = unsubscribeStrategyDoc;
      }

      return () => {
        unsubscribeEvents();
        unsubscribeCap();
        unsubscribeUsers();
        unsubscribePendingUsers();
        unsubscribeAds();
        unsubscribeStrategy();
        unsubscribeComplaints();
      };
    }

    return () => {
      unsubscribeEvents();
      unsubscribeCap();
      unsubscribeUsers();
      unsubscribePendingUsers();
      unsubscribeComplaints();
    };
  }, [profile, isDeveloper, isPrincipal, isHOD, isManagementStaff, hodDepartment, hasManagementAccess]);

  const myPendingEvents = pendingEvents.filter(event => {
    const effectiveStage = getEffectiveStage(event);

    if (isHOD && !isPrincipal) {
      return effectiveStage === "hod" && event.hostDepartment?.toUpperCase() === hodDepartment;
    }
    if (isPrincipal) {
      return effectiveStage === "principal";
    }
    return false;
  });

  const handleApproveEvent = async (event) => {
    setProcessing(event.id);
    try {
      const effectiveStage = getEffectiveStage(event);

      if (isHOD && !isPrincipal && effectiveStage === "hod") {
        await updateDoc(doc(db, "events", event.id), {
          approvalStage: "principal",
          stageUpdatedAt: Date.now()
        });

        await sendNotification({
          title: "Event Forwarded to Principal",
          message: `Your event was approved by the HOD and sent to the Principal.`,
          link: `/my-events`,
          recipients: [event.hostId],
          type: "EVENT"
        });
        toast.success("Approved and forwarded to Principal!");

      } else if (isPrincipal && effectiveStage === "principal") {
        await updateDoc(doc(db, "events", event.id), { status: "approved" });

        await sendNotification({
          title: "Event Officially Approved!",
          message: `Your event "${event.title}" is now live on the dashboard!`,
          link: `/event/${event.id}`,
          recipients: [event.hostId],
          type: "EVENT"
        });

        await sendNotification({
          title: "New Event Announced!",
          message: `"${event.title}" is now open. Check it out!`,
          link: `/event/${event.id}`,
          recipients: ["all"],
          type: "EVENT"
        });
        toast.success("Event fully approved and published!");
      }
    } catch (error) {
      toast.error("Failed to update event status.");
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
      const event = pendingEvents.find(e => e.id === selectedEventId);
      const rejectorRole = isPrincipal ? "Principal / Admin" : `HOD of ${hodDepartment}`;

      await updateDoc(doc(db, "events", selectedEventId), {
        status: "rejected",
        rejectionReason: rejectionReason.trim(),
        rejectedByRole: rejectorRole
      });

      if (event && event.hostId) {
        await sendNotification({
          title: "Event Rejected",
          message: `Your event "${event.title}" was rejected by ${rejectorRole}. Reason: ${rejectionReason.trim()}`,
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

  const handleComplaintAction = async (complaintId, newStatus) => {
    try {
      await updateDoc(doc(db, "complaints", complaintId), { status: newStatus });
      toast.success(`Complaint moved to ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update complaint.");
    }
  };

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
    if (!isDeveloper) {
      toast.error("Only developers can create advertisements.");
      return;
    }
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
    if (!isDeveloper) return;
    try {
      await deleteDoc(doc(db, "advertisements", adId));
      toast.success("Advertisement deleted");
    } catch (error) {
      console.error("Ad deletion error:", error);
      toast.error("Failed to delete advertisement");
    }
  };

  const handleUpdateAdStrategy = async (strategy) => {
    if (!isDeveloper) return;
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
          actualCount = allUsers.filter(u => u.role === "faculty" && u.department?.toUpperCase() === cap.department?.toUpperCase()).length;
        } else {
          actualCount = allUsers.filter(u =>
            u.role === "student" &&
            u.department?.toUpperCase() === cap.department?.toUpperCase() &&
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

  const handleAddCapacity = async (e) => {
    e.preventDefault();

    const dept = (isHOD && !isDeveloper && !isManagementStaff) ? hodDepartment : (newDept === "CUSTOM" ? customDept.toUpperCase() : newDept);

    if (!dept) return;

    if (isHOD && !isDeveloper && !isManagementStaff && dept !== hodDepartment) {
      toast.error(`You can only manage capacities for the ${hodDepartment} department.`);
      return;
    }

    const id = capacityType === "student" ? `${dept}_${newYear}` : `${dept}_FACULTY`;

    try {
      const docRef = doc(db, "departmentCapacity", id);
      const deletedDocRef = doc(db, "deletedCapacities", id);

      let registeredCount = 0;
      const deletedDocSnap = await getDoc(deletedDocRef);
      if (deletedDocSnap.exists()) {
        registeredCount = deletedDocSnap.data().registeredCount || 0;
        await deleteDoc(deletedDocRef);
      } else {
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
      const developerResponse = await fetch("/api/verify-developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, password: passwordModal.developerPassword })
      });
      const developerData = await developerResponse.json();

      if (!developerData.valid) {
        throw new Error(developerData.error || "Invalid developer password");
      }

      if (passwordModal.action !== "delete_user") {
        const managementResponse = await fetch("/api/verify-secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "management", secret: passwordModal.password })
        });
        const managementData = await managementResponse.json();

        if (!managementData.valid) {
          throw new Error("Invalid management secret key");
        }
      }

      if (passwordModal.action === "end_batch") {
        await executeEndBatch(passwordModal.capacity);
      } else if (passwordModal.action === "delete_capacity") {
        await executeDeleteCapacity(passwordModal.capacity);
      } else if (passwordModal.action === "delete_user") {
        await executeDeleteUser(passwordModal.userToDelete);
      }

      setPasswordModal({ isOpen: false, action: null, capacity: null, userToDelete: null, password: "", developerPassword: "", error: "", loading: false });
    } catch (error) {
      console.error("Verification failed:", error);
      setPasswordModal(prev => ({ ...prev, error: error.message || "Verification failed", loading: false }));
    }
  };

  const executeDeleteUser = async (userToDelete) => {
    if (!userToDelete?.id) {
      toast.error("User ID is missing");
      return;
    }

    try {
      const response = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: userToDelete.id,
          developerEmail: profile.email
        })
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      toast.success(`User ${userToDelete.displayName} deleted successfully.`);
    } catch (error) {
      toast.error("Failed to delete user: " + error.message);
    }
  };

  const executeEndBatch = async (cap) => {
    try {
      const usersToUpdate = allUsers.filter(u =>
        u.role === "student" &&
        u.department?.toUpperCase() === cap.department?.toUpperCase() &&
        u.yearOfJoin?.toString() === cap.yearOfJoin?.toString()
      );

      const updatePromises = usersToUpdate.map(u =>
        updateDoc(doc(db, "users", u.id), { role: "alumni" })
      );
      await Promise.all(updatePromises);

      await deleteDoc(doc(db, "departmentCapacity", cap.id));
      toast.success(`Batch ${cap.department} ${cap.yearOfJoin} ended successfully.`);
    } catch (error) {
      toast.error("Failed to end batch");
    }
  };

  const executeDeleteCapacity = async (cap) => {
    try {
      const isFaculty = cap.type === "faculty";
      const usersToDelete = allUsers.filter(u => {
        if (isFaculty) {
          return u.role === "faculty" && u.department?.toUpperCase() === cap.department?.toUpperCase();
        }
        return u.role === "student" &&
          u.department?.toUpperCase() === cap.department?.toUpperCase() &&
          u.yearOfJoin?.toString() === cap.yearOfJoin?.toString();
      });

      const deletePromises = usersToDelete.map(async (u) => {
        await deleteDoc(doc(db, "users", u.id));
        if (u.studentId) {
          await deleteDoc(doc(db, "studentIds", u.studentId));
        }
      });
      await Promise.all(deletePromises);

      await deleteDoc(doc(db, "departmentCapacity", cap.id));
      toast.success(`Capacity deleted and ${usersToDelete.length} users removed.`);
    } catch (error) {
      toast.error("Failed to delete capacity");
    }
  };

  const handleApproveUser = async (userId) => {
    setProcessing(userId);
    try {
      const userToApprove = pendingManagers.find(m => m.id === userId);
      await updateDoc(doc(db, "users", userId), { isApproved: true });
      await sendNotification({
        title: "Account Approved",
        message: `Your account has been approved. You now have full access.`,
        link: "/dashboard",
        recipients: [userId],
        type: "SYSTEM"
      });
      toast.success(`Account approved!`);
    } catch (error) {
      toast.error("Failed to approve account.");
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectUser = async () => {
    if (!managerToReject) return;
    setProcessing(managerToReject);
    try {
      const userToReject = pendingManagers.find(m => m.id === managerToReject);
      await deleteDoc(doc(db, "users", managerToReject));
      if (userToReject?.studentId) {
        await deleteDoc(doc(db, "studentIds", userToReject.studentId));
      }
      if (userToReject?.facultyId) {
        await deleteDoc(doc(db, "facultyIds", userToReject.facultyId));
      }
      toast.success("Account request rejected and data cleared.");
      setManagerToReject(null);
    } catch (error) {
      toast.error("Failed to reject account.");
    } finally {
      setProcessing(null);
    }
  };

  const handleAssignTutor = async (facultyId, batchYear) => {
    try {
      const isTutor = !!batchYear;
      await updateDoc(doc(db, "users", facultyId), {
        isTutor,
        tutorOf: batchYear || null
      });
      toast.success(isTutor ? `Assigned as tutor for ${batchYear} batch.` : "Removed from tutor role.");
    } catch (error) {
      toast.error("Failed to assign tutor.");
    }
  };

  const totalCapacity = capacities.reduce((acc, curr) => acc + (curr.totalStudents || 0), 0);

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
            <ShieldCheck size={12} className="text-blue-500" />
            <span>{isPrincipal ? "Principal Dashboard" : `${hodDepartment} Department Hub`}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-zinc-900 mb-2">Management Dashboard</h1>
          <p className="text-zinc-500 text-lg">Overview of campus operations and approvals.</p>
        </div>
        {hasManagementAccess && (
          <div className="flex flex-wrap gap-4 pb-4 md:pb-0">
            {isDeveloper && (
              <button onClick={syncCapacities} disabled={loading} className="bg-zinc-900 text-white px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all flex items-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={16} /> : "Sync Counts"}
              </button>
            )}
            <div className="bg-zinc-50 px-4 py-3 rounded-2xl border border-zinc-100 text-center min-w-[80px] shrink-0">
              <div className="text-2xl font-bold text-zinc-900 mb-1">{myPendingEvents.length}</div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pending Events</div>
            </div>
            {isPrincipal && (
              <div className="bg-red-50 px-4 py-3 rounded-2xl border border-red-100 text-center min-w-[80px] shrink-0">
                <div className="text-2xl font-bold text-red-600 mb-1">{verifiedComplaints.length}</div>
                <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Escalated Complaints</div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 🔥 NEW SECTION: VERIFIED COMPLAINTS FOR PRINCIPAL 🔥 */}
      {isPrincipal && verifiedComplaints.length > 0 && (
        <section className="bg-red-50/50 border border-red-100 rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              <AlertCircle className="text-red-500" size={24} />
              Action Required: Escalated Complaints
            </h2>
          </div>
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {verifiedComplaints.map(complaint => {
                const votes = complaint.panelVotes || {};
                const agreeCount = Object.values(votes).filter(v => v === "agree").length;
                const disagreeCount = Object.values(votes).filter(v => v === "disagree").length;
                const neitherCount = Object.values(votes).filter(v => v === "neither").length;

                const isAutoEscalated = complaint.status === "pending";

                return (
                  <motion.div
                    key={complaint.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold">
                          {complaint.authorCodeName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900">{complaint.authorCodeName}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-600 bg-emerald-50 border-emerald-100">
                              Real: {complaint.authorRealName}
                            </span>
                            {isAutoEscalated && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-red-600 bg-red-50 border-red-100 flex items-center gap-1">
                                <Clock size={10} /> Auto-Escalated (Time Expired)
                              </span>
                            )}
                            {!isAutoEscalated && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-indigo-600 bg-indigo-50 border-indigo-100 flex items-center gap-1">
                                <ShieldCheck size={10} /> Verified by Panel
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400">
                            {complaint.createdAt?.toDate ? format(complaint.createdAt.toDate(), "MMM d, yyyy h:mm a") : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200">
                        <span className="text-emerald-600">{agreeCount} Agree</span> •
                        <span className="text-red-600">{disagreeCount} Disagree</span> •
                        <span className="text-amber-600">{neitherCount} Neither</span>
                      </div>
                    </div>

                    <p className="text-zinc-700 font-medium bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                      {complaint.text}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => handleComplaintAction(complaint.id, "in-progress")}
                        className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-sm transition-all"
                      >
                        Mark In-Progress
                      </button>
                      <button
                        onClick={() => handleComplaintAction(complaint.id, "resolved")}
                        className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20"
                      >
                        Resolve Complaint
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      <div className={cn("grid grid-cols-1 gap-8 items-start", hasManagementAccess ? "lg:grid-cols-3" : "")}>
        <div className={cn("space-y-8", hasManagementAccess ? "lg:col-span-2" : "")}>
          {(hasManagementAccess || profile?.isTutor) && (
            <section className="bg-emerald-50/50 border border-emerald-100 rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={24} />
                  Pending User Approvals
                </h2>
              </div>
              {pendingManagers.length > 0 ? (
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
                          onClick={() => handleApproveUser(user.id)}
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
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-1">All Caught Up!</h3>
                  <p className="text-zinc-500">There are no pending account approvals at this time.</p>
                </div>
              )}
            </section>
          )}

          {/* 🔥 USER DIRECTORY WITH PANEL HEAD LOGIC 🔥 */}
          {hasManagementAccess && (
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
              <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {allUsers
                  .filter(u =>
                    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.studentId?.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.facultyId?.toLowerCase().includes(userSearch.toLowerCase())
                  )
                  .map(u => (
                    <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100 group hover:border-emerald-200 transition-all gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-400 shrink-0">
                          {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover rounded-xl" /> : u.displayName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-zinc-900 uppercase truncate">{u.displayName}</h4>
                          <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={cn("text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", u.role === "alumni" ? "bg-amber-100 text-amber-700" : u.role === "faculty" ? "bg-purple-100 text-purple-700" : u.role === "management" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>{u.role}</span>
                            {u.isPanelMember && <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">Panel Member</span>}
                            {u.isPanelHead && <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1"><Sparkles size={8} /> Panel Head</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap justify-end">
                        {/* MAKE PANEL MEMBER BUTTON */}
                        {isPrincipal && (
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, "users", u.id), {
                                  isPanelMember: !u.isPanelMember,
                                  isPanelHead: false // If removed from panel, also remove head status
                                });
                                toast.success(`${u.displayName} panel status updated.`);
                              } catch (error) { toast.error("Failed to update panel status."); }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                              u.isPanelMember ? "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100" : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                            )}
                          >
                            {u.isPanelMember ? "Remove Panel" : "Make Panel"}
                          </button>
                        )}

                        {/* MAKE PANEL HEAD BUTTON */}
                        {isPrincipal && u.isPanelMember && (
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, "users", u.id), { isPanelHead: !u.isPanelHead });
                                toast.success(`${u.displayName} is ${!u.isPanelHead ? 'now' : 'no longer'} the Panel Head.`);
                              } catch (error) { toast.error("Failed to update head status."); }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1",
                              u.isPanelHead ? "bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100" : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                            )}
                          >
                            <Sparkles size={12} />
                            {u.isPanelHead ? "Remove Head" : "Make Head"}
                          </button>
                        )}

                        <button
                          onClick={() => setPasswordModal({ isOpen: true, action: "delete_user", userToDelete: u, password: "", developerPassword: "", error: "", loading: false })}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete User Permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                }
                {allUsers.length > 0 && allUsers.filter(u =>
                  u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
                  u.email?.toLowerCase().includes(userSearch.toLowerCase())
                ).length === 0 && (
                    <div className="col-span-2 py-12 text-center">
                      <p className="text-sm text-zinc-500">No users found matching "{userSearch}"</p>
                    </div>
                  )}
              </div>
            </section>
          )}

          {(isHOD || isDeveloper) && (
            <section className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <GraduationCap className="text-purple-600" size={24} />
                  Assign Tutors
                </h2>
              </div>
              <div className="grid gap-4">
                {allUsers
                  .filter(u => u.role === "faculty" && (isDeveloper || u.department?.toUpperCase() === hodDepartment))
                  .map(faculty => (
                    <div key={faculty.id} className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center font-bold text-xl">
                          {faculty.displayName?.[0] || "F"}
                        </div>
                        <div>
                          <h4 className="font-bold text-zinc-900 uppercase">{faculty.displayName}</h4>
                          <p className="text-sm text-zinc-500">{faculty.email} • {faculty.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <select
                          value={faculty.tutorOf || ""}
                          onChange={(e) => handleAssignTutor(faculty.id, e.target.value)}
                          className="w-full md:w-48 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        >
                          <option value="">Not a Tutor</option>
                          {[...new Set(capacities.filter(c => c.department?.toUpperCase() === faculty.department?.toUpperCase() && c.yearOfJoin !== "FACULTY").map(c => c.yearOfJoin))].sort((a, b) => b - a).map(year => (
                            <option key={year} value={year}>{year} Batch</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                {allUsers.filter(u => u.role === "faculty" && (isDeveloper || u.department?.toUpperCase() === hodDepartment)).length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    No faculty members found in this department.
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 🔥 RESTRICTED ADVERTISEMENT SECTION 🔥 */}
          {isDeveloper && (
            <section className="bg-zinc-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-zinc-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                  <Megaphone className="text-emerald-400" size={24} />
                  Advertisement Management
                </h2>
                <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider border border-white/10 shrink-0 self-start sm:self-auto">
                  Developer Only
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

          {/* 🔥 EVENT APPROVAL PIPELINE 🔥 */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                <Clock className="text-amber-500" size={24} />
                Events Requiring Attention
              </h2>
              <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-100">
                {myPendingEvents.length} Pending
              </span>
            </div>

            {myPendingEvents.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center shadow-sm">
                <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                  <CheckCircle2 className="text-emerald-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">Inbox Empty!</h3>
                <p className="text-zinc-500 max-w-xs mx-auto">
                  There are no event requests waiting at your stage right now.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {myPendingEvents.map((event) => {
                    const stage = getEffectiveStage(event);
                    const timeLeft = Math.max(0, STAGE_TIMEOUT - (Date.now() - (event.stageUpdatedAt || event.createdAt)));
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                    return (
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
                            <img src={event.posterUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          </div>
                          <div className="flex-1 p-4 md:p-8 flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-blue-100">
                                    {stage === "hod" ? "HOD Stage" : "Principal Stage"}
                                  </span>
                                  {stage === "hod" && (
                                    <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                                      <Clock size={12} /> Auto-forwards in {hoursLeft}h {minutesLeft}m
                                    </span>
                                  )}
                                  {event.approvalStage !== stage && (
                                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded">
                                      Auto-escalated (Lower tier timed out)
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">{event.title}</h3>
                                <p className="text-sm text-zinc-500">Host: <strong className="text-zinc-700">{event.hostName}</strong> ({event.hostRole} - {event.hostDepartment})</p>
                              </div>
                            </div>

                            <div className="mt-auto pt-6 border-t border-zinc-100 flex flex-wrap gap-3">
                              <Link to={`/event/${event.id}`} className="px-4 py-2 rounded-xl bg-zinc-50 text-zinc-600 text-sm font-bold hover:bg-zinc-100 transition-all flex items-center gap-2">
                                <Eye size={16} /> Details
                              </Link>
                              <div className="flex-1" />
                              <button
                                onClick={() => {
                                  setSelectedEventId(event.id);
                                  setRejectModalOpen(true);
                                }}
                                disabled={!!processing}
                                className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                              >
                                <XCircle size={16} /> Reject
                              </button>
                              <button
                                onClick={() => handleApproveEvent(event)}
                                disabled={!!processing}
                                className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-lg shadow-zinc-900/20"
                              >
                                {processing === event.id ? <Loader2 className="animate-spin" size={16} /> : (stage === "hod" ? <Forward size={16} /> : <CheckCircle2 size={16} />)}
                                {stage === "hod" ? "Approve & Forward to Principal" : "Final Approval (Publish)"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Capacity Management */}
        {hasManagementAccess && (
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
                        value={(isHOD && !isDeveloper && !isManagementStaff) ? hodDepartment : newDept}
                        onChange={(e) => setNewDept(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white [&>option]:text-zinc-900"
                        disabled={!!editingCapacity || (isHOD && !isDeveloper && !isManagementStaff)}
                      >
                        {(isHOD && !isDeveloper && !isManagementStaff) ? (
                          <option value={hodDepartment}>{hodDepartment}</option>
                        ) : (
                          <>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="ME">ME</option>
                            <option value="CE">CE</option>
                            <option value="EEE">EEE</option>
                            <option value="ICE">ICE</option>
                            <option value="AS">AS</option>
                            <option value="IT">IT</option>
                            <option value="CUSTOM">Custom...</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  {newDept === "CUSTOM" && (!isHOD || isDeveloper || isManagementStaff) && (
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
                        required
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
                        return u.role === "faculty" && u.department?.toUpperCase() === cap.department?.toUpperCase();
                      }
                      return u.role === "student" &&
                        u.department?.toUpperCase() === cap.department?.toUpperCase() &&
                        u.yearOfJoin?.toString() === cap.yearOfJoin?.toString();
                    })
                    .sort((a, b) => {
                      if (isFaculty) return (a.displayName || "").localeCompare(b.displayName || "");
                      return (a.studentId || "").localeCompare(b.studentId || "");
                    });
                  const isExpanded = expandedCapacityId === cap.id;

                  // Ensure HODs only see edit buttons for their own department
                  const canEditCapacity = isDeveloper || isManagementStaff || (isHOD && cap.department?.toUpperCase() === hodDepartment);

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
                          {canEditCapacity && (
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
                          )}
                          {isDeveloper && !isFaculty && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPasswordModal({ isOpen: true, action: "end_batch", capacity: cap, password: "", developerPassword: "", error: "", loading: false });
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
                                setPasswordModal({ isOpen: true, action: "delete_capacity", capacity: cap, password: "", developerPassword: "", error: "", loading: false });
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
                                                password: "",
                                                developerPassword: "",
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
        )}
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
              <p className="text-zinc-500 mb-6">Are you sure you want to reject this request? Their data will be deleted.</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setManagerToReject(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectUser}
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
              <p className="text-zinc-500 mb-6">Please provide a reason for rejecting this event. The host will be notified.</p>

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
                Please enter the developer password to confirm.
              </p>

              <form onSubmit={handlePasswordConfirm}>
                <input
                  type="password"
                  value={passwordModal.developerPassword}
                  onChange={(e) => setPasswordModal(prev => ({ ...prev, developerPassword: e.target.value, error: "" }))}
                  placeholder="Developer Email Password"
                  className={cn(
                    "w-full p-4 bg-zinc-50 border rounded-xl mb-2 focus:outline-none focus:ring-2 transition-all",
                    passwordModal.error ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" : "border-zinc-200 focus:ring-emerald-500/20 focus:border-emerald-500"
                  )}
                  autoFocus
                  required
                />
                {passwordModal.action !== "delete_user" && (
                  <input
                    type="password"
                    value={passwordModal.password}
                    onChange={(e) => setPasswordModal(prev => ({ ...prev, password: e.target.value, error: "" }))}
                    placeholder="Management Secret Key"
                    className={cn(
                      "w-full p-4 bg-zinc-50 border rounded-xl mb-2 focus:outline-none focus:ring-2 transition-all",
                      passwordModal.error ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" : "border-zinc-200 focus:ring-emerald-500/20 focus:border-emerald-500"
                    )}
                  />
                )}
                {passwordModal.error && (
                  <p className="text-red-500 text-xs font-bold mb-4 ml-1">{passwordModal.error}</p>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setPasswordModal({ isOpen: false, action: null, capacity: null, userToDelete: null, password: "", developerPassword: "", error: "", loading: false })}
                    className="flex-1 py-3 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={(passwordModal.action !== "delete_user" && (!passwordModal.password && !passwordModal.developerPassword)) || passwordModal.loading}
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