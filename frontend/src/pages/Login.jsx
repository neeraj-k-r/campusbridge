import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
  signOut // <-- ADDED: Needed to kick out deleted users
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, where } from "firebase/firestore";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import { LogIn, UserPlus, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { cn } from "../lib/utils";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [managerSecret, setManagerSecret] = useState("");
  const [facultySecret, setFacultySecret] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [rollNo, setRollNo] = useState("");
  const [yearOfJoin, setYearOfJoin] = useState(new Date().getFullYear().toString());
  const [role, setRole] = useState("student");
  const [codeName, setCodeName] = useState("");
  const [codeNameError, setCodeNameError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const q = collection(db, "departmentCapacity");
        const snapshot = await getDocs(q);
        const depts = new Set();
        snapshot.docs.forEach(doc => depts.add(doc.data().department));
        const deptArray = Array.from(depts).sort();

        if (deptArray.length > 0) {
          setAvailableDepartments(deptArray);
          if (!department) setDepartment(deptArray[0]);
        } else {
          setAvailableDepartments(["CSE", "ECE", "ME", "CE", "EE", "IT"]);
        }
      } catch (error) {
        console.warn("Using fallback departments due to restricted access or empty collection.");
        setAvailableDepartments(["CSE", "ECE", "ME", "CE", "EE", "IT"]);
        if (!department) setDepartment("CSE");
      }
    };

    fetchDepartments();
  }, [department]);

  const generateStudentId = () => {
    const yearSuffix = yearOfJoin.slice(-2);
    let deptCode = department;
    if (department === "CSE") deptCode = "CS";
    else if (department === "ECE") deptCode = "EC";
    else if (department === "ME") deptCode = "ME";
    else if (department === "CE") deptCode = "CE";
    else if (department === "EE") deptCode = "EE";
    else if (department === "IT") deptCode = "IT";

    const paddedRollNo = rollNo.padStart(3, '0');
    return `SNM${yearSuffix}${deptCode}${paddedRollNo}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trimmedEmail = email.trim();

      if (isLogin) {
        // --- FIXED: Added the "Bouncer" check for deleted users ---
        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);

        // Check if the user's database document was deleted by an admin
        const userDocRef = doc(db, "users", userCredential.user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // The admin deleted their account! Force sign them out immediately.
          await signOut(auth);
          toast.error("Your account has been deactivated or deleted by management.");
          setLoading(false);
          return;
        }

        sessionStorage.removeItem("hasSeenAd");
        sessionStorage.removeItem("lastSeenAdId");
        toast.success("Welcome back!");
        // --- END OF FIX ---

      } else {
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setLoading(false);
          return;
        }
        if (role === "student" && !codeName.trim()) {
          toast.error("Code Name is required for anonymous complaints");
          setLoading(false);
          return;
        }
        if (role === "faculty" && !facultyId.trim()) {
          toast.error("Faculty ID is required");
          setLoading(false);
          return;
        }

        // --- DIRECT FIRESTORE SECRET CHECK ---
        if (role === "management" || role === "faculty") {
          const secretInput = role === "management" ? managerSecret : facultySecret;

          try {
            const secretDocRef = doc(db, "settings", "secrets");
            const secretSnap = await getDoc(secretDocRef);

            if (secretSnap.exists()) {
              const actualSecret = role === "management"
                ? secretSnap.data().managerSecret
                : secretSnap.data().facultySecret;

              if (secretInput.trim() !== actualSecret) {
                toast.error(`Invalid ${role === "management" ? "Manager" : "Faculty"} Secret Code`);
                setLoading(false);
                return;
              }
            } else {
              toast.error("Security settings not configured in database.");
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error("Error verifying secret:", error);
            toast.error("Failed to verify secret code. Check database permissions.");
            setLoading(false);
            return;
          }
        }

        let finalStudentId = "";

        if (role === "student") {
          if (!rollNo.trim() || !yearOfJoin.trim()) {
            toast.error("Roll No and Year of Join are required for students");
            setLoading(false);
            return;
          }
          finalStudentId = generateStudentId();
        }

        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const user = userCredential.user;
        sessionStorage.removeItem("hasSeenAd");
        sessionStorage.removeItem("lastSeenAdId");

        try {
          if (role === "student") {
            const q = query(collection(db, "users"), where("codeName", "==", codeName));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setCodeNameError("This Code Name is already taken. Please choose another.");
              throw new Error("CODENAME_TAKEN");
            }

            const studentIdRef = doc(db, "studentIds", finalStudentId);
            const studentIdSnap = await getDoc(studentIdRef);

            if (studentIdSnap.exists()) {
              throw new Error(`Student ID ${finalStudentId} is already registered`);
            }

            const dept = department.trim();
            const yearStr = yearOfJoin.toString().trim();
            const yearNum = parseInt(yearStr);

            const capId = `${dept}_${yearStr}`;
            let capRef = doc(db, "departmentCapacity", capId);
            let capSnap = await getDoc(capRef);

            if (!capSnap.exists()) {
              const qString = query(
                collection(db, "departmentCapacity"),
                where("department", "==", dept),
                where("yearOfJoin", "==", yearStr)
              );
              const snapString = await getDocs(qString);

              if (!snapString.empty) {
                capSnap = snapString.docs[0];
                capRef = capSnap.ref;
              } else {
                const qNum = query(
                  collection(db, "departmentCapacity"),
                  where("department", "==", dept),
                  where("yearOfJoin", "==", yearNum)
                );
                const snapNum = await getDocs(qNum);
                if (!snapNum.empty) {
                  capSnap = snapNum.docs[0];
                  capRef = capSnap.ref;
                }
              }
            }

            if (capSnap.exists()) {
              let capData = capSnap.data();
              const qActual = query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("department", "==", dept),
                where("yearOfJoin", "==", yearStr)
              );
              const snapActual = await getDocs(qActual);
              const actualCount = snapActual.size;

              if (actualCount >= capData.totalStudents) {
                throw new Error(`Department capacity reached for ${dept} ${yearStr}.`);
              }
              await updateDoc(capRef, { registeredCount: actualCount + 1 });
            } else {
              await setDoc(capRef, {
                department: dept,
                yearOfJoin: yearStr,
                totalStudents: 100,
                registeredCount: 1,
                type: "student"
              });
            }

            await setDoc(studentIdRef, {
              uid: user.uid,
              email: user.email,
              createdAt: Date.now()
            });
          }

          if (role === "faculty") {
            const dept = department.trim();
            const capId = `${dept}_FACULTY`;
            const capRef = doc(db, "departmentCapacity", capId);
            const capSnap = await getDoc(capRef);

            if (capSnap.exists()) {
              let capData = capSnap.data();
              const qActual = query(
                collection(db, "users"),
                where("role", "==", "faculty"),
                where("department", "==", dept)
              );
              const snapActual = await getDocs(qActual);
              const actualCount = snapActual.size;

              if (actualCount >= capData.totalStudents) {
                throw new Error(`Faculty capacity reached for ${dept}.`);
              }
              await updateDoc(capRef, { registeredCount: actualCount + 1 });
            } else {
              throw new Error(`Faculty capacity not set for ${dept} by management.`);
            }
          }

          await updateProfile(user, { displayName });

          const userData = {
            uid: user.uid,
            email: trimmedEmail,
            displayName,
            role,
            policyAccepted: false,
            isApproved: role === "management" ? (trimmedEmail === "campusbridgeofficials@gmail.com") : (role === "faculty" ? false : true),
            createdAt: Date.now(),
          };

          if (role === "student") {
            userData.studentId = finalStudentId;
            userData.department = department;
            userData.rollNo = rollNo;
            userData.yearOfJoin = yearOfJoin;
            userData.codeName = codeName;
          } else if (role === "faculty") {
            userData.department = department;
            userData.facultyId = facultyId;
          }

          await setDoc(doc(db, "users", user.uid), userData);
          toast.success("Account created successfully!");

        } catch (err) {
          await deleteUser(user).catch(console.error);
          throw err;
        }
      }
    } catch (error) {
      if (error.message !== "CODENAME_TAKEN") {
        console.error("Signup/Login Error:", error);
      }

      const errorMessage = error.message || "";
      const errorCode = error.code || "";

      if (errorMessage === "CODENAME_TAKEN") {
        // Handled inline
      } else if (errorCode === "auth/invalid-credential" || errorMessage.includes("auth/invalid-credential")) {
        toast.error(isLogin ? "Invalid email or password." : "Credentials provided are invalid for signup.");
      } else if (errorCode === "auth/email-already-in-use" || errorMessage.includes("auth/email-already-in-use")) {
        toast.error("This email is already registered. Please login instead.");
      } else if (errorCode === "auth/weak-password" || errorMessage.includes("auth/weak-password")) {
        toast.error("Password should be at least 6 characters.");
      } else if (errorCode === "permission-denied" || errorMessage.includes("permission-denied")) {
        toast.error("Database access denied. Please check Firestore rules.");
      } else {
        toast.error(error.message || "An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/50 relative z-10 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900" />

        <div className="p-8 md:p-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white mb-6 shadow-xl shadow-emerald-600/20 transform -rotate-6">
              <GraduationCap size={32} />
            </div>
            <h1 className="text-4xl font-serif font-bold text-zinc-900 mb-2 tracking-tight">SNMIMT Campus</h1>
            <p className="text-zinc-500 font-medium">College Event Management System</p>
          </div>

          <div className="flex bg-zinc-100/80 p-1.5 rounded-2xl mb-8 backdrop-blur-sm">
            <button
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300",
                isLogin ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
              )}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300",
                !isLogin ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">I am a...</label>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setRole("student")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300",
                        role === "student"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/10"
                          : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <GraduationCap size={24} />
                      <span className="text-sm font-bold">Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("faculty")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300",
                        role === "faculty"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/10"
                          : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <Users size={24} />
                      <span className="text-sm font-bold">Faculty</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("management")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300",
                        role === "management"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/10"
                          : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <ShieldCheck size={24} />
                      <span className="text-sm font-bold">Manager</span>
                    </button>
                  </div>
                </div>

                {role === "management" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="overflow-hidden"
                  >
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Manager Secret Code</label>
                    <input
                      type="password"
                      required
                      value={managerSecret}
                      onChange={(e) => setManagerSecret(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                      placeholder="Enter secret code"
                    />
                  </motion.div>
                )}

                {role === "faculty" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Faculty ID</label>
                      <input
                        type="text"
                        required
                        value={facultyId}
                        onChange={(e) => setFacultyId(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                        placeholder="Enter your Faculty ID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Faculty Secret Code</label>
                      <input
                        type="password"
                        required
                        value={facultySecret}
                        onChange={(e) => setFacultySecret(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                        placeholder="Enter secret code"
                      />
                    </div>
                  </motion.div>
                )}

                {(role === "student" || role === "faculty") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-5 overflow-hidden"
                  >
                    {role === "student" && (
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Code Name (For Anonymous Complaints)</label>
                        <input
                          type="text"
                          required
                          value={codeName}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^[a-zA-Z0-9_.]*$/.test(val)) {
                              setCodeName(val);
                              setCodeNameError("");
                            } else {
                              setCodeNameError("Only letters, numbers, dots (.), and underscores (_) are allowed.");
                            }
                          }}
                          className={cn(
                            "w-full px-4 py-3 bg-zinc-50/50 border rounded-xl focus:outline-none focus:ring-2 transition-all font-medium",
                            codeNameError
                              ? "border-red-300 focus:ring-red-500/10 focus:border-red-500 text-red-900 placeholder:text-red-300"
                              : "border-zinc-200 focus:ring-emerald-600/10 focus:border-emerald-300"
                          )}
                          placeholder="e.g. ShadowWalker"
                        />
                        {codeNameError && (
                          <p className="mt-1.5 ml-1 text-xs font-bold text-red-500 animate-in slide-in-from-top-1">
                            {codeNameError}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Department</label>
                      <div className="relative">
                        <select
                          required
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium appearance-none"
                        >
                          {availableDepartments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    {role === "student" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Roll No</label>
                            <input
                              type="number"
                              required
                              min="1"
                              max="999"
                              value={rollNo}
                              onChange={(e) => setRollNo(e.target.value)}
                              className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                              placeholder="e.g. 37"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Year of Join</label>
                            <input
                              type="number"
                              required
                              min="2000"
                              max="2099"
                              value={yearOfJoin}
                              onChange={(e) => setYearOfJoin(e.target.value)}
                              className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                              placeholder="e.g. 2023"
                            />
                          </div>
                        </div>
                        <div className="p-4 bg-emerald-900/5 rounded-2xl text-center border border-emerald-900/5">
                          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Generated Student ID</span>
                          <span className="font-mono font-bold text-2xl text-zinc-900 tracking-tight">{generateStudentId() || "SNM..."}</span>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                placeholder="email@college.edu"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                placeholder="••••••••"
              />
            </div>

            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
              >
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-300 transition-all font-medium"
                  placeholder="••••••••"
                />
              </motion.div>
            )}

            <div className="flex items-center gap-2 ml-1">
              <input
                type="checkbox"
                id="showPassword"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600 w-4 h-4"
              />
              <label htmlFor="showPassword" className="text-sm font-medium text-zinc-600 cursor-pointer select-none">Show Password</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-6"
            >
              {loading ? (
                <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn size={20} />
                  <span>Login to Dashboard</span>
                </>
              ) : (
                <>
                  <UserPlus size={20} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}