import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  BookOpen, 
  Users, 
  Award, 
  Globe, 
  MapPin, 
  Phone, 
  Mail,
  Sparkles,
  Monitor,
  Settings,
  HardHat,
  Cpu,
  Zap,
  Gauge,
  GraduationCap,
  Library,
  Building2,
  ChevronRight
} from "lucide-react";

const departments = [
  { 
    name: "Computer Science & Engineering", 
    icon: Monitor, 
    about: "The Department of Computer Science and Engineering came into existence with the establishment of the institute in 2002. The department aims to provide students with strong conceptual foundations and also expose them to the forefront of development in the field of computing.",
    vision: "To be recognized for delivering quality education in computer science and engineering to meet the evolving demands of the industry.",
    mission: "Delivering quality engineering education focused on enhancing problem-solving abilities and leadership skills for societal and national advancement."
  },
  { 
    name: "Mechanical Engineering", 
    icon: Settings, 
    about: "Established during the academic year 2004-2005, the department conducts a 4-year B.Tech programme. Mechanical engineering is essential for a wide range of activities like design, development, manufacture, control and management of Engineering systems.",
    vision: "To become a center of excellence in Mechanical Engineering discipline, producing innovative and creative Mechanical Engineers to address the global challenges for the betterment of society.",
    mission: "To provide a platform to the students attaining quality education in Mechanical Engineering. To educate students in professional and ethical responsibility and train them to build leadership and entrepreneurship qualities."
  },
  { 
    name: "Civil Engineering", 
    icon: HardHat, 
    about: "The department of civil engineering is an emerging department and was started in the college in the academic year 2011-12. It aims to cater to the needs of society for qualified civil engineers with high standards of technical expertise and moral ethics.",
    vision: "To establish an outstanding centre of regional and national reputation and for providing a quality engineering education to the students.",
    mission: "Our mission is to advance knowledge and educate students in science, technology and other areas of vital importance, which will best serve the nation in the 21st century."
  },
  { 
    name: "Electronics & Communication", 
    icon: Cpu, 
    about: "Started in 2002, this is a major department offering an undergraduate programme. The department has well-equipped laboratories and excellent infrastructure, regularly conducting technical symposiums and workshops.",
    vision: "To emerge as an excellent and efficient department, offering quality education in Electronics and Communication Engineering with focus on technological advancement so as to cater to the needs of the industry and society at large.",
    mission: "Create a unique environment to enable the students to face the challenges of the Electronics and Communication Engineering field. Provide ethical and value based education by promoting activities addressing the societal needs."
  },
  { 
    name: "Electrical & Electronics", 
    icon: Zap, 
    about: "One of the founding departments in SNMIMT Maliankara, started functioning in 2002. The course is designed to provide excellent technical knowledge in the emerging areas of Electrical and Electronics Engineering.",
    vision: "To pursue excellence in the field of electrical and electronics engineering.",
    mission: "To be a centre of excellence in moulding students into outstanding professionals of high ethical standards in electrical and electronics engineering."
  },
  { 
    name: "Instrumentation & Control", 
    icon: Gauge, 
    about: "Instrumentation is the art and science of measurement and control of process variables. This multi-disciplinary stream covers subjects from Chemical, Mechanical, Electrical, Electronics and Computer Science.",
    vision: "Excellence in Instrumentation and Control Engineering education through innovative practices and team work.",
    mission: "To provide strong theoretical foundation complemented with extensive practical training. To encourage the students to be innovative, competent, efficient and value oriented."
  },
];

const stats = [
  { value: "20+", label: "Years of Excellence" },
  { value: "6", label: "Engineering Departments" },
  { value: "1000+", label: "Successful Alumni" },
  { value: "100%", label: "Commitment to Quality" },
];

const features = [
  { icon: GraduationCap, title: "Expert Faculty", desc: "Learn from experienced professors and industry professionals dedicated to your success and holistic development." },
  { icon: Library, title: "Library", desc: "Access thousands of journals, books, and digital resources in our state-of-the-art, quiet study environment." },
  { icon: Building2, title: "Advanced Labs", desc: "Get hands-on experience in our fully equipped, modern laboratories and technical workshops." },
];

export default function Landing() {
  return (
    <div className="bg-white selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center py-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://res.cloudinary.com/dtzdgkimi/image/upload/v1772818845/SNMIMT_b1_ckrk64.jpg" 
            alt="SNMIMT Campus" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/95 via-zinc-900/80 to-zinc-900/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-emerald-900/20" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="max-w-3xl text-white"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-[0.2em] rounded-full mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Established 2002
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold leading-[1.1] mb-8 tracking-tight">
              Building a <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Better Future</span>
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-300 mb-10 max-w-2xl font-light leading-relaxed border-l-2 border-emerald-500 pl-6">
              Sree Narayana Mangalam Institute of Management and Technology is a premier engineering institution dedicated to excellence in technical education and holistic development based on values.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-5">
              <Link 
                to="/login" 
                className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-emerald-900/20"
              >
                Access Portal <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </Link>
              <a 
                href="#about" 
                className="px-8 py-4 bg-white/5 backdrop-blur-md border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all text-center flex items-center justify-center gap-2"
              >
                Discover SNMIMT <ChevronRight size={20} className="text-zinc-400" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-20 px-4 -mt-10 md:-mt-16">
        <div className="container mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 p-8 md:p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 divide-x divide-zinc-100">
              {stats.map((stat, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center px-4"
                >
                  <div className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 mb-2">{stat.value}</div>
                  <div className="text-xs md:text-sm font-bold text-emerald-600 uppercase tracking-wider">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-32 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-50 rounded-full blur-3xl -z-10" />
              <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-8 h-px bg-emerald-600" /> About Our Institute
              </h2>
              <h3 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 mb-8 leading-tight">
                A Legacy of Excellence <br/>and Social Reform
              </h3>
              <div className="space-y-6 text-zinc-600 leading-relaxed text-lg font-light">
                <p>
                  SNM Institute of Management and Technology is one of the most prestigious and earliest self-financing engineering colleges in Kerala. Owned and managed by the HMDP Sabha (established 1882), we follow the teachings of the great social reformer, Sree Narayana Guru.
                </p>
                <p>
                  Our campus at Maliankara, established in 2002, is the jewel in the crown of HMDP Sabha, providing state-of-the-art facilities and a nurturing environment for the engineers of tomorrow.
                </p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-8 mt-12 pt-12 border-t border-zinc-100">
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 shrink-0">
                    <Award size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-lg mb-1">ISO 9001:2015</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">Internationally recognized for quality management systems.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 shrink-0">
                    <Users size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-lg mb-1">HMDP Sabha</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">Backed by over a century of educational heritage.</p>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative lg:ml-auto"
            >
              <div className="absolute inset-0 bg-emerald-600 rounded-[2.5rem] rotate-3 scale-105 opacity-10 -z-10 transition-transform duration-500 hover:rotate-6" />
              <img 
                src="https://res.cloudinary.com/dtzdgkimi/image/upload/v1772823594/images_v6aanw.jpg" 
                alt="SNMIMT Campus Area" 
                className="rounded-[2.5rem] shadow-2xl w-full max-w-lg object-cover aspect-[4/5]"
                referrerPolicy="no-referrer"
              />
              
              <div className="absolute -bottom-8 -left-8 bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 max-w-[240px]">
                <div className="flex items-center gap-4 mb-3">
                  <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <div className="text-3xl font-serif font-bold text-zinc-900">2002</div>
                </div>
                <p className="text-sm font-medium text-zinc-600 leading-relaxed">
                  Founded with a vision to provide quality technical education to all.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-zinc-50 border-y border-zinc-100">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                  <feature.icon size={28} />
                </div>
                <h4 className="text-xl font-bold text-zinc-900 mb-3">{feature.title}</h4>
                <p className="text-zinc-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Departments Section */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4">Academic Programs</h2>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 mb-6">Specialized Engineering Streams</h3>
            <p className="text-lg text-zinc-500 font-light leading-relaxed">
              We offer a comprehensive range of undergraduate programs designed to equip students with the technical skills and theoretical knowledge needed for a successful career.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {departments.map((dept, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-white rounded-[2rem] border border-zinc-200 p-8 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-900/5 transition-all duration-500 flex flex-col h-full overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-500 shrink-0 shadow-sm">
                      <dept.icon size={32} strokeWidth={1.5} />
                    </div>
                    <h4 className="text-xl font-bold text-zinc-900 leading-tight">{dept.name}</h4>
                  </div>
                  
                  <div className="space-y-8 flex-1 flex flex-col">
                    <div className="flex-1">
                      <p className="text-zinc-600 text-sm leading-relaxed font-light">{dept.about}</p>
                    </div>
                    
                    <div className="space-y-4 pt-6 border-t border-zinc-100">
                      <div>
                        <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Globe size={12} /> Vision
                        </h5>
                        <p className="text-zinc-600 text-xs leading-relaxed font-medium">{dept.vision}</p>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Award size={12} /> Mission
                        </h5>
                        <p className="text-zinc-600 text-xs leading-relaxed font-medium">{dept.mission}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="absolute inset-0 bg-[url('https://res.cloudinary.com/dtzdgkimi/image/upload/v1772818845/SNMIMT_b1_ckrk64.jpg')] opacity-10 bg-cover bg-center mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-transparent" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">Ready to Shape Your Future?</h2>
            <p className="text-xl text-zinc-400 font-light mb-10">
              Join SNMIMT and be part of an institution that values innovation, ethics, and excellence.
            </p>
            <Link 
              to="/login" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
            >
              Access Student Portal <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 text-zinc-400 py-20 border-t border-zinc-900">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-12 gap-12 lg:gap-8 mb-16">
            <div className="md:col-span-5 lg:col-span-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-600 p-2 rounded-xl text-white">
                  <BookOpen size={24} />
                </div>
                <span className="text-2xl font-serif font-bold tracking-tight text-white">SNMIMT</span>
              </div>
              <p className="text-sm leading-relaxed mb-8 max-w-sm">
                Sree Narayana Mangalam Institute of Management and Technology is dedicated to providing quality technical education and fostering innovation among students.
              </p>
              
              <div className="p-5 bg-zinc-900/80 rounded-2xl border border-zinc-800 inline-block w-full max-w-sm">
                <h5 className="font-bold mb-4 uppercase text-[10px] tracking-widest text-emerald-500 flex items-center gap-2">
                  <Sparkles size={14} /> Contact Developer
                </h5>
                <ul className="space-y-3 text-sm">
                  <li>
                    <a href="mailto:campusbridgeofficials@gmail.com" className="flex items-center gap-3 hover:text-emerald-400 transition-colors">
                      <Mail size={16} className="text-zinc-500" />
                      campusbridgeofficials@gmail.com
                    </a>
                  </li>
                  <li>
                    <a href="https://instagram.com/campusbridge_officials" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-emerald-400 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                      @campusbridge_officials
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="md:col-span-3 lg:col-span-2 lg:col-start-7">
              <h5 className="font-bold mb-6 uppercase text-[10px] tracking-widest text-white">Quick Links</h5>
              <ul className="space-y-4 text-sm">
                <li><Link to="/login" className="hover:text-emerald-400 transition-colors flex items-center gap-2"><ChevronRight size={14} /> Student Login</Link></li>
                <li><Link to="/login" className="hover:text-emerald-400 transition-colors flex items-center gap-2"><ChevronRight size={14} /> Management Portal</Link></li>
                <li><Link to="/privacy" className="hover:text-emerald-400 transition-colors flex items-center gap-2"><ChevronRight size={14} /> Privacy Policy</Link></li>
                <li><a href="https://www.snmimt.edu.in/" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors flex items-center gap-2"><ChevronRight size={14} /> Official Website</a></li>
              </ul>
            </div>

            <div className="md:col-span-4 lg:col-span-3">
              <h5 className="font-bold mb-6 uppercase text-[10px] tracking-widest text-white">Contact Us</h5>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Maliankara P.O, Moothakunnam,<br/>Ernakulam, Kerala - 683516</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-emerald-500 shrink-0" />
                  <span>0484 2484133, 2483333</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-emerald-500 shrink-0" />
                  <span>info@snmimt.edu.in</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
            <p>&copy; {new Date().getFullYear()} SNM Institute of Management and Technology. All rights reserved.</p>
            <p>Designed for Excellence</p>
          </div>
        </div>
      </footer>
    </div>
  );
}