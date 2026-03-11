import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { deleteUser, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Trash2, AlertTriangle, User, Mail, Hash, BookOpen, Calendar, Shield, Lock, KeyRound, Eye, EyeOff, Camera, Loader2 } from "lucide-react";
import ImageCropper from "../components/ImageCropper";
import { cn } from "../lib/utils";

// Cloudinary Config
const CLOUDINARY_CLOUD_NAME = "dbyraj0xm";
const CLOUDINARY_UPLOAD_PRESET = "campus_posters";

export default function Account({ profile: initialProfile }) {
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Show password state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // Profile picture state
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState(null);

  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }
      }
    };
    if (!initialProfile) {
      fetchProfile();
    }
  }, [user, initialProfile]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!user?.email) return;
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password should be at least 6 characters");
      return;
    }

    setResetLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      toast.success("Password updated successfully!");
      
      // Clear fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Change password error:", error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error("Incorrect current password");
      } else if (error.code === 'auth/too-many-requests') {
        toast.error("Too many failed attempts. Please try again later.");
      } else {
        toast.error("Failed to update password: " + error.message);
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    if (e) e.preventDefault();
    
    if (!deletePassword) {
      toast.error("Please enter your password to confirm deletion");
      return;
    }

    setLoading(true);
    try {
      if (!user?.email) throw new Error("No user logged in");

      // 1. Re-authenticate for security
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Delete studentId reservation if it exists
      if (profile?.studentId) {
        const studentIdRef = doc(db, "studentIds", profile.studentId);
        try {
          await deleteDoc(studentIdRef);
        } catch (error) {
          console.error("Error deleting studentId reservation:", error);
        }
      }

      // 3. Decrement registeredCount in departmentCapacity if applicable
      if (profile?.department && profile?.yearOfJoin) {
        const capId = `${profile.department}_${profile.yearOfJoin}`;
        const capRef = doc(db, "departmentCapacity", capId);
        const capSnap = await getDoc(capRef);
        if (capSnap.exists()) {
          const capData = capSnap.data();
          await updateDoc(capRef, { registeredCount: Math.max(0, capData.registeredCount - 1) });
        }
      }

      // 4. Delete user profile document
      await deleteDoc(doc(db, "users", user.uid));

      // 5. Delete auth account
      await deleteUser(user);

      toast.success("Account deleted successfully.");
      navigate("/login");
    } catch (error) {
      console.error("Delete account error:", error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error("Incorrect password");
      } else {
        toast.error("Failed to delete account: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileFileChange = (e) => {
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

  const handleCropComplete = async (file, previewUrl) => {
    setShowCropper(false);
    setTempImage(null);
    setUploading(true);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
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
        const photoURL = uploadedJson.secure_url;
        await updateDoc(doc(db, "users", user.uid), { photoURL });
        setProfile(prev => ({ ...prev, photoURL }));
        toast.success("Profile picture updated!");
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Profile upload error:", error);
      toast.error("Failed to update profile picture");
    } finally {
      setUploading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {showCropper && (
        <ImageCropper 
          image={tempImage} 
          onCropComplete={handleCropComplete} 
          onCancel={() => {
            setShowCropper(false);
            setTempImage(null);
          }}
          aspectRatio={1}
        />
      )}
      <header>
        <h1 className="text-4xl font-serif font-bold text-zinc-900 mb-2">Account Settings</h1>
        <p className="text-zinc-500">Manage your profile and account preferences.</p>
      </header>

      <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="h-32 bg-zinc-900 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg group relative">
              <div className="w-full h-full bg-zinc-100 rounded-xl flex items-center justify-center text-3xl font-bold text-zinc-400 overflow-hidden">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  profile.displayName?.charAt(0)
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" size={24} />
                  </div>
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                <input type="file" accept="image/*" className="hidden" onChange={handleProfileFileChange} disabled={uploading} />
                <Camera className="text-white" size={24} />
              </label>
            </div>
          </div>
        </div>
        
        <div className="pt-16 pb-8 px-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-zinc-900 uppercase truncate">{profile.displayName}</h2>
              <p className="text-zinc-500 truncate">{profile.email}</p>
            </div>
            <div className="px-3 py-1 bg-zinc-100 rounded-full text-xs font-bold uppercase tracking-wider text-zinc-600 border border-zinc-200 flex items-center gap-1.5 self-start shrink-0">
              <Shield size={12} />
              {profile.email === "campusbridgeofficials@gmail.com" ? "developer" : profile.role}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profile.role === "student" && (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Hash size={14} /> Student ID
                </div>
                <div className="text-zinc-900 font-bold text-lg">{profile.studentId || "N/A"}</div>
              </div>
            )}
            {profile.role === "student" && (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <User size={14} /> Code Name
                </div>
                <div className="text-zinc-900 font-bold text-lg">{profile.codeName || "N/A"}</div>
              </div>
            )}
            {(profile.role === "student" || profile.role === "faculty") && (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <BookOpen size={14} /> Department
                </div>
                <div className="text-zinc-900 font-bold text-lg">{profile.department || "N/A"}</div>
              </div>
            )}
            {profile.role === "student" && (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Calendar size={14} /> Year of Join
                </div>
                <div className="text-zinc-900 font-bold text-lg">{profile.yearOfJoin || "N/A"}</div>
              </div>
            )}
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                <User size={14} /> Role
              </div>
              <div className="text-zinc-900 font-bold text-lg capitalize">{profile.email === "campusbridgeofficials@gmail.com" ? "developer" : profile.role}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-[2rem] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="bg-emerald-50 p-3 rounded-xl shrink-0">
            <Mail className="text-emerald-600" size={24} />
          </div>
          <div className="flex-1 min-w-0 w-full">
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Contact Developer</h3>
            <p className="text-zinc-500 mb-6 leading-relaxed text-sm sm:text-base">
              Have feedback, found a bug, or need help? Get in touch with the development team.
            </p>
            
            <div className="flex flex-col xl:flex-row gap-4">
              <a 
                href="mailto:campusbridgeofficials@gmail.com"
                className="flex items-center gap-3 px-4 sm:px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 hover:border-zinc-300 transition-all group overflow-hidden"
              >
                <div className="w-10 h-10 shrink-0 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Mail size={20} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Email Us</div>
                  <div className="text-sm font-bold text-zinc-900 truncate">campusbridgeofficials@gmail.com</div>
                </div>
              </a>
              
              <a 
                href="https://instagram.com/campusbridge_officials"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 sm:px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 hover:border-zinc-300 transition-all group overflow-hidden"
              >
                <div className="w-10 h-10 shrink-0 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Follow Us</div>
                  <div className="text-sm font-bold text-zinc-900 truncate">@campusbridge_officials</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-[2rem] p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-zinc-100 p-3 rounded-xl shrink-0">
            <Lock className="text-zinc-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Change Password</h3>
            <p className="text-zinc-500 mb-6 leading-relaxed">
              Update your password to keep your account secure.
            </p>
            
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={resetLoading}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg shadow-zinc-900/20 mt-2"
              >
                {resetLoading ? "Updating..." : <><KeyRound size={18} /> Update Password</>}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <div className="bg-red-50 border border-red-100 rounded-[2rem] p-8">
        <div className="flex items-start gap-4">
          <div className="bg-red-100 p-3 rounded-xl shrink-0">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-red-900 mb-2">Danger Zone</h3>
            <p className="text-red-700/80 mb-6 leading-relaxed">
              Deleting your account will permanently remove your profile, event registrations, and release your Student ID for others to use. This action cannot be undone.
            </p>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
              >
                <Trash2 size={18} /> Delete My Account
              </button>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-red-200 space-y-4 max-w-md">
                <p className="text-sm font-bold text-red-900">Confirm deletion by entering your password:</p>
                <div className="relative">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {loading ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword("");
                    }}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
