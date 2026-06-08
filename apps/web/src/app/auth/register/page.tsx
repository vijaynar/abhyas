'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { 
  Building2, Eye, EyeOff, Globe, Lock, Mail, Sparkles, User, 
  Check, CheckCircle2, ChevronLeft, ChevronRight, X, Phone, 
  ShieldCheck, FileText, MapPin, AlertCircle, Camera, ArrowLeft, ArrowRight,
  Upload, Trash2
} from 'lucide-react';

const COACH_STEPS = [
  { id: 1, name: 'Personal Information', desc: 'Basic details & location' },
  { id: 2, name: 'Professional Profile', desc: 'Your skills and experience' },
  { id: 3, name: 'Documents', desc: 'Upload identity & certificates' },
  { id: 4, name: 'Account Security', desc: 'Secure your account' },
  { id: 5, name: 'Review & Submit', desc: 'Review your information' },
];


const PRIMARY_SKILLS = [
  'Badminton', 'Tennis', 'Table Tennis', 'Squash', 'Swimming', 
  'Football', 'Cricket', 'Basketball', 'Athletics', 'Gymnastics'
];

const SPECIALIZATIONS = [
  'Singles', 'Doubles', 'Mixed Doubles', 'Coaching', 'Physical Training', 
  'Tactics', 'Advanced Techniques', 'Beginner Basics'
];

// Must match DB constraint: Online/Offline/Hybrid — shown with friendly labels
const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: 'Offline', label: 'Offline Coaching' },
  { value: 'Online', label: 'Online Coaching' },
  { value: 'Hybrid', label: 'Hybrid (Online + Offline)' },
];

// Must match DB constraint: One-to-One/Group Classes
const CLASS_TYPES: { value: string; label: string }[] = [
  { value: 'Group Classes', label: 'Group Classes' },
  { value: 'One-to-One', label: 'One-to-One Sessions' },
];

const LANGUAGES = [
  'English', 'Hindi', 'Kannada', 'Telugu', 'Tamil', 'Malayalam', 'Marathi', 'Gujarati'
];

const DOCUMENT_TYPES = [
  { key: 'Aadhaar Card', label: 'Aadhaar Card', required: true, hint: 'Upload front & back of your Aadhaar card' },
  { key: 'PAN Card', label: 'PAN Card', required: true, hint: 'Upload a clear photo of your PAN card' },
  { key: 'Qualification Certificate', label: 'Qualification Certificate', required: true, hint: 'Degree or diploma certificate' },
  { key: 'NIS Certification', label: 'NIS Certification', required: false, hint: 'National Institute of Sports certification (if applicable)' },
  { key: 'Experience Certificate', label: 'Experience Certificate', required: false, hint: 'Previous employer / academy letter' },
];

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role');
  const tenantId = searchParams.get('tenantId');
  const isCoach = role === 'coach' && !!tenantId;
  const supabase = createBrowserClient();

  // ----------------------------------------------------
  // ORIGINAL ACADEMY ONBOARDING STATES
  // ----------------------------------------------------
  const [academyFirstName, setAcademyFirstName] = useState('');
  const [academyLastName, setAcademyLastName] = useState('');
  const [academyEmail, setAcademyEmail] = useState('');
  const [academyPassword, setAcademyPassword] = useState('');
  const [academyPhone, setAcademyPhone] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [academyCountry, setAcademyCountry] = useState('India');
  const [academyState, setAcademyState] = useState('Telangana');
  const [academyCity, setAcademyCity] = useState('Hyderabad');
  const [academyAddress, setAcademyAddress] = useState('');
  const [academyShowPassword, setAcademyShowPassword] = useState(false);

  // ----------------------------------------------------
  // COACH ONBOARDING STATES
  // ----------------------------------------------------
  const [coachStep, setCoachStep] = useState(1);
  const [onboardPhoto, setOnboardPhoto] = useState<File | null>(null);
  const [onboardPhotoPreview, setOnboardPhotoPreview] = useState<string>('');
  
  // Step 1
  const [coachFirstName, setCoachFirstName] = useState('');
  const [coachLastName, setCoachLastName] = useState('');
  const [coachEmail, setCoachEmail] = useState('');
  const [coachPhone, setCoachPhone] = useState('');
  const [coachPassword, setCoachPassword] = useState('');
  const [coachShowPassword, setCoachShowPassword] = useState(false);
  const [coachGender, setCoachGender] = useState('Male');
  const [coachDOB, setCoachDOB] = useState('');
  // Inline validation touch states
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Step 2
  const [primarySkill, setPrimarySkill] = useState('Badminton');
  const [specialization, setSpecialization] = useState('Singles');
  const [experienceYears, setExperienceYears] = useState('6');
  const [qualification, setQualification] = useState('B.P.Ed, NIS Certified');
  const [languagesKnown, setLanguagesKnown] = useState<string[]>(['English', 'Hindi', 'Kannada']);
  const [serviceTypes, setServiceTypes] = useState<string[]>(['Offline', 'Online']);
  const [classTypes, setClassTypes] = useState<string[]>(['Group Classes']);
  const [bio, setBio] = useState('Passionate badminton coach with 6+ years of experience in training players of all levels. Focused on skill development, fitness and mindset building to help players achieve their best.');
  const [langInput, setLangInput] = useState('');

  // Step 3 — Documents
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({
    'Aadhaar Card': null,
    'PAN Card': null,
    'Qualification Certificate': null,
    'NIS Certification': null,
    'Experience Certificate': null,
  });
  const [docUploading, setDocUploading] = useState(false);

  // Step 4 — Location
  const [coachCountry, setCoachCountry] = useState('India');
  const [coachState, setCoachState] = useState('Karnataka');
  const [coachCity, setCoachCity] = useState('Bangalore');
  const [coachArea, setCoachArea] = useState('Indiranagar');
  const [coachAddress, setCoachAddress] = useState('123, 5th Main, Indiranagar, Bangalore, Karnataka - 560038');

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Test Mode Feature Flag
  const [isTestMode, setIsTestMode] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('testmode')) {
        setIsTestMode(true);
      }
    }
  }, []);

  const fillRandomCoachData = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const firstNames = ['Amit', 'Raj', 'Vikram', 'Sanjay', 'Rahul', 'Pooja', 'Anjali', 'Neha', 'Sunita', 'Karan'];
    const lastNames = ['Sharma', 'Verma', 'Kumar', 'Singh', 'Patel', 'Joshi', 'Mehta', 'Nair', 'Das', 'Gupta'];
    const skills = ['Badminton', 'Tennis', 'Table Tennis', 'Squash', 'Swimming', 'Football', 'Cricket', 'Basketball', 'Athletics', 'Gymnastics'];
    const specializations = ['Singles', 'Doubles', 'Mixed Doubles', 'Coaching', 'Physical Training', 'Tactics', 'Advanced Techniques', 'Beginner Basics'];
    // Use DB-valid values only
    const serviceTypesOptions = ['Offline', 'Online', 'Hybrid'];
    const classTypesOptions = ['Group Classes', 'One-to-One'];
    const languagesList = ['English', 'Hindi', 'Kannada', 'Telugu', 'Tamil', 'Malayalam', 'Marathi', 'Gujarati'];
    const genders = ['Male', 'Female'];
    
    const randFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randEmail = `coach.${randFirst.toLowerCase()}.${randLast.toLowerCase()}.${randomId}@upasthiti.com`;
    const randPhone = '9' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    const randPassword = `Test@Pass${randomId}!`;
    
    const randSkill = skills[Math.floor(Math.random() * skills.length)];
    const randSpecialization = specializations[Math.floor(Math.random() * specializations.length)];
    const randExp = String(Math.floor(2 + Math.random() * 15));
    const randQual = `B.P.Ed, NIS Certified ${randSkill} Coach`;
    const randGender = genders[Math.floor(Math.random() * genders.length)];
    // Random DOB between 25-45 years ago
    const randAge = 25 + Math.floor(Math.random() * 20);
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - randAge);
    const randDOB = dob.toISOString().split('T')[0];
    
    const randLangs = [...new Set(Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => languagesList[Math.floor(Math.random() * languagesList.length)]))];
    const randServices = [...new Set(Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => serviceTypesOptions[Math.floor(Math.random() * serviceTypesOptions.length)]))];
    const randClasses = [classTypesOptions[Math.floor(Math.random() * classTypesOptions.length)]];
    
    const randBio = `Passionate ${randSkill} coach specializing in ${randSpecialization.toLowerCase()} with ${randExp} years of coaching experience. Focused on developing athletic skills and active participation.`;
    
    const cities = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai'];
    const states = ['Karnataka', 'Maharashtra', 'Delhi', 'Telangana', 'Maharashtra', 'Tamil Nadu'];
    const areas = ['Indiranagar', 'Koramangala', 'Bandra', 'Connaught Place', 'Gachibowli', 'Jayanagar'];
    const cityIdx = Math.floor(Math.random() * cities.length);
    const randCity = cities[cityIdx];
    const randState = states[cityIdx];
    const randArea = areas[Math.floor(Math.random() * areas.length)];
    const randAddress = `123, 5th Main, ${randArea}, ${randCity}, ${randState} - ${Math.floor(560001 + Math.random() * 99)}`;

    setCoachFirstName(randFirst);
    setCoachLastName(randLast);
    setCoachEmail(randEmail);
    setCoachPhone(randPhone);
    setCoachPassword(randPassword);
    setCoachGender(randGender);
    setCoachDOB(randDOB);
    setEmailTouched(false);
    setPhoneTouched(false);
    
    setPrimarySkill(randSkill);
    setSpecialization(randSpecialization);
    setExperienceYears(randExp);
    setQualification(randQual);
    setLanguagesKnown(randLangs);
    setServiceTypes(randServices);
    setClassTypes(randClasses);
    setBio(randBio);
    
    setCoachCountry('India');
    setCoachState(randState);
    setCoachCity(randCity);
    setCoachArea(randArea);
    setCoachAddress(randAddress);

    // Mock photo preview
    const dummyFile = new File([""], "avatar.jpg", { type: "image/jpeg" });
    setOnboardPhoto(dummyFile);
    setOnboardPhotoPreview(`https://api.dicebear.com/7.x/adventurer/svg?seed=${randFirst}${randomId}`);
  };

  const fillRandomAcademyData = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const firstNames = ['Rajesh', 'Suresh', 'Kiran', 'Nisha', 'Sunil', 'Vijay'];
    const lastNames = ['Patil', 'Deshmukh', 'Reddy', 'Rao', 'Sharma', 'Gupta'];
    const academies = ['Pro Sports Academy', 'Elite Badminton Arena', 'Super Kickers Club', 'Champion Tennis Academy', 'Velocity Swim Club'];
    
    const randFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randEmail = `admin.${randFirst.toLowerCase()}.${randLast.toLowerCase()}.${randomId}@upasthiti.com`;
    const randPhone = '9' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    const randPassword = `Admin@Pass${randomId}!`;
    const randName = academies[Math.floor(Math.random() * academies.length)] + ` ${randomId}`;
    
    setAcademyFirstName(randFirst);
    setAcademyLastName(randLast);
    setAcademyEmail(randEmail);
    setAcademyPassword(randPassword);
    setAcademyPhone(randPhone);
    setTenantName(randName);
    const slug = randName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setTenantSlug(slug);
    setAcademyCountry('India');
    setAcademyState('Karnataka');
    setAcademyCity('Bangalore');
    setAcademyAddress(`456 Sports Hub Lane, Indiranagar, Bangalore - 560038`);
  };

  // Auto-generate slug from Tenant Name
  const handleTenantNameChange = (val: string) => {
    setTenantName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setTenantSlug(slug);
  };

  const handleAcademyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: academyEmail,
          password: academyPassword,
          firstName: academyFirstName,
          lastName: academyLastName,
          phone: academyPhone || null,
          tenantName,
          tenantSlug,
          country: academyCountry,
          state: academyState,
          city: academyCity,
          address: academyAddress || null
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to complete registration.');
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: academyEmail,
        password: academyPassword,
      });

      if (loginError) {
        throw new Error('Registration succeeded, but auto-login failed. Please sign in manually.');
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during registration.');
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // COACH HANDLERS
  // ----------------------------------------------------
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file size must be less than 2MB.');
        return;
      }
      setOnboardPhoto(file);
      setOnboardPhotoPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const removeLanguage = (lang: string) => {
    setLanguagesKnown(languagesKnown.filter(l => l !== lang));
  };

  const addLanguage = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = langInput.trim();
      if (val && !languagesKnown.includes(val)) {
        setLanguagesKnown([...languagesKnown, val]);
        setLangInput('');
      }
    }
  };

  const handleUploadAvatar = async (userId: string, file: File) => {
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/coach_${userId}_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('avatars').upload(path, file);
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Error uploading avatar:', err);
      return null;
    }
  };

  const handleCoachRegisterSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      // 1. Submit Registration API
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'coach',
          tenantId,
          email: coachEmail,
          password: coachPassword,
          firstName: coachFirstName,
          lastName: coachLastName,
          phone: coachPhone ? `+91${coachPhone}` : null,
          primarySkill,
          experienceYears: Number(experienceYears),
          serviceTypes,
          classTypes,
          languagesKnown,
          qualification,
          bio,
          country: coachCountry,
          state: coachState,
          city: coachCity,
          area: coachArea,
          address: coachAddress,
          specialization,
          gender: coachGender,
          dateOfBirth: coachDOB || null,
          joiningDate: new Date().toISOString().split('T')[0]
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to complete coach registration.');
      }

      const userId = result.data?.userId || result.userId;

      // 2. Client Sign In
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: coachEmail,
        password: coachPassword,
      });

      if (loginError) {
        throw new Error('Coach registration succeeded, but auto-login failed. Please sign in manually.');
      }

      // 3. Record session (login tracking)
      fetch('/api/v1/auth/session', { method: 'POST' }).catch(() => {});

      // 4. Upload avatar image if selected
      if (onboardPhoto && userId) {
        const publicUrl = await handleUploadAvatar(userId, onboardPhoto);
        if (publicUrl) {
          const { error: updateErr } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);
          if (updateErr) {
            console.error('Failed to update coach avatar URL:', updateErr);
          }
        }
      }

      // 5. Upload documents to coach-certificates bucket
      if (userId) {
        setDocUploading(true);
        const docEntries = Object.entries(docFiles).filter(([, file]) => file !== null) as [string, File][];
        for (const [docType, file] of docEntries) {
          try {
            const ext = file.name.split('.').pop() || 'pdf';
            const path = `doc_${userId}_${docType.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from('coach-certificates')
              .upload(path, file, { upsert: true, contentType: file.type });
            if (uploadError) { console.error(`Doc upload error (${docType}):`, uploadError); continue; }
            const { data: urlData } = supabase.storage.from('coach-certificates').getPublicUrl(path);
            const publicUrl = urlData.publicUrl;
            let mappedType = 'Other';
            if (docType === 'Aadhaar Card' || docType === 'PAN Card') mappedType = 'Government ID';
            else if (docType === 'Qualification Certificate' || docType === 'NIS Certification') mappedType = 'Certification';
            else if (docType === 'Experience Certificate') mappedType = 'Resume';
            const tenantRes = await supabase.from('users').select('tenant_id').eq('id', userId).single();
            const tenantIdForDoc = tenantRes.data?.tenant_id || tenantId;
            await supabase.from('coach_documents').insert({
              coach_id: userId,
              tenant_id: tenantIdForDoc,
              document_type: mappedType,
              document_name: docType,
              file_url: publicUrl,
              verification_status: 'Pending',
            });
          } catch (docErr) {
            console.error(`Failed to upload ${docType}:`, docErr);
          }
        }

        // 6. Update coach status based on whether all mandatory documents were uploaded
        // Mandatory documents are: Aadhaar Card, PAN Card, and Qualification Certificate
        const hasAadhaar = docFiles['Aadhaar Card'] !== null;
        const hasPan = docFiles['PAN Card'] !== null;
        const hasQual = docFiles['Qualification Certificate'] !== null;
        const hasAllMandatory = hasAadhaar && hasPan && hasQual;

        const finalStatus = hasAllMandatory ? 'Pending Verification' : 'Document Upload Pending';
        const { error: statusUpdateErr } = await supabase
          .from('coaches')
          .update({ account_status: finalStatus })
          .eq('id', userId);

        if (statusUpdateErr) {
          console.error('Failed to update coach status:', statusUpdateErr);
        }

        setDocUploading(false);
      }

      // 7. Redirect to Dashboard
      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during coach registration.');
      setLoading(false);
    }
  };

  // Password validation checks
  const coachHasLength = coachPassword.length >= 8;
  const coachHasUppercase = /[A-Z]/.test(coachPassword);
  const coachHasNumber = /\d/.test(coachPassword);
  const coachHasSpecial = /[^A-Za-z0-9]/.test(coachPassword);
  const isCoachPasswordValid = coachHasLength && coachHasUppercase && coachHasNumber && coachHasSpecial;

  // Inline email & phone validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coachEmail);
  const isPhoneValid = coachPhone.length === 10;

  // Screen level form validation states
  const isStep1Valid = coachFirstName.trim() !== '' && coachLastName.trim() !== '' && isEmailValid && isPhoneValid && isCoachPasswordValid && coachGender !== '' && coachDOB !== '' && coachCountry.trim() !== '' && coachState.trim() !== '' && coachCity.trim() !== '';
  const isStep2Valid = primarySkill.trim() !== '' && specialization.trim() !== '' && experienceYears.trim() !== '' && qualification.trim() !== '' && serviceTypes.length > 0 && classTypes.length > 0 && bio.trim() !== '' && bio.length <= 500;
  // Step 3 = Documents (no strict validation, optional)
  const isStep3Valid = true;
  const isStep4Valid = true;

  if (isCoach) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col lg:flex-row font-sans">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[320px] xl:w-[360px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-8 flex flex-col justify-between shrink-0">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                U
              </div>
              <span className="font-extrabold text-slate-900 tracking-tight text-base">
                UPASTHITI
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Coach Onboarding
            </h2>
            <p className="text-slate-500 text-xs mb-8">
              Complete these steps to set up your coach profile
            </p>

            {/* Steps Vertical Checklist */}
            <div className="space-y-4">
              {COACH_STEPS.map((s) => {
                const isActive = coachStep === s.id;
                const isCompleted = coachStep > s.id;
                return (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 p-3 rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? 'bg-indigo-50 border border-indigo-100' 
                        : 'border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transition-all ${
                      isCompleted 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}>
                      {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : s.id}
                    </div>
                    <div>
                      <h4 className={`text-sm font-semibold leading-tight ${
                        isActive ? 'text-indigo-900 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                      }`}>
                        {s.name}
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${
                        isActive ? 'text-indigo-600 font-medium' : 'text-slate-400'
                      }`}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {/* Info Safe Card */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-indigo-800">
                <span className="font-semibold block mb-0.5">Your information is safe</span>
                We use industry-standard security to protect your data and privacy.
              </div>
            </div>

            {/* Already have account */}
            <div className="text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-700 font-bold inline-flex items-center gap-0.5 transition-colors">
                Sign In <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
          {/* Header toolbar */}
          <div className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <span>Academy Management</span>
            </span>
            <div className="flex items-center gap-4">
              <a href="mailto:support@upasthiti.com" className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1">
                Need help?
              </a>
              <div className="h-4 w-[1px] bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200">
                  RS
                </div>
                <span className="text-xs font-semibold text-slate-700">Rohan Sharma</span>
              </div>
            </div>
          </div>

          {/* Form Wizard Inner Container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-12 flex justify-center">
            <div className="w-full max-w-3xl flex flex-col justify-between">
              
              {/* Stepper horizontal dots */}
              <div className="hidden md:flex items-center justify-between w-full mb-10 border-b border-slate-200 pb-5">
                {COACH_STEPS.map((s, idx) => (
                  <div key={s.id} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        coachStep === s.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : coachStep > s.id
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        {coachStep > s.id ? <Check className="w-4 h-4 stroke-[3]" /> : s.id}
                      </div>
                      <span className={`text-xs font-semibold whitespace-nowrap ${
                        coachStep === s.id ? 'text-slate-900 font-bold' : 'text-slate-400'
                      }`}>
                        {s.name}
                      </span>
                    </div>
                    {idx < COACH_STEPS.length - 1 && (
                      <div className={`h-[2px] flex-1 mx-4 min-w-[20px] transition-colors duration-300 ${
                        coachStep > s.id ? 'bg-emerald-500' : 'bg-slate-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Error Box */}
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {/* Wizard forms */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 flex-1 flex flex-col justify-between min-h-[460px]">
                {isTestMode && (
                  <div className="mb-6 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                      <span className="text-xs text-indigo-700 font-bold tracking-wide uppercase text-[10px]">Test Mode Active</span>
                    </div>
                    <button
                      type="button"
                      onClick={fillRandomCoachData}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <span>⚡ Auto-fill Test Data</span>
                    </button>
                  </div>
                )}
                
                {/* ----------------- STEP 1 ----------------- */}
                {coachStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-900">
                          Let's start with your basic information
                        </h3>
                        <span className="text-[10px] font-semibold text-red-500">* Required fields</span>
                      </div>
                    </div>

                    {/* Profile Photo Upload */}
                    <div className="space-y-2">
                      <label className="text-slate-700 text-xs font-bold block">
                        Profile Photo
                      </label>
                      <div className="text-[11px] text-slate-400 mb-2">
                        This will be visible to students and academy admins.
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 relative group flex items-center justify-center shrink-0">
                          {onboardPhotoPreview ? (
                            <img src={onboardPhotoPreview} className="w-full h-full object-cover" alt="Avatar preview" />
                          ) : (
                            <User className="w-10 h-10 text-slate-400" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="inline-flex items-center px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition-colors shadow-sm">
                            <Camera className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                            Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="hidden"
                            />
                          </label>
                          <p className="text-[10px] text-slate-400">JPG, PNG up to 2MB</p>
                        </div>
                      </div>
                    </div>

                    {/* Name fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">First Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={coachFirstName}
                          onChange={(e) => setCoachFirstName(e.target.value)}
                          placeholder="Rohan"
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Last Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={coachLastName}
                          onChange={(e) => setCoachLastName(e.target.value)}
                          placeholder="Sharma"
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        />
                      </div>
                    </div>

                    {/* Contact details: Email */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Email Address <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            value={coachEmail}
                            onChange={(e) => setCoachEmail(e.target.value)}
                            onBlur={() => setEmailTouched(true)}
                            placeholder="rohan.sharma@example.com"
                            className={`w-full h-11 pl-4 pr-10 rounded-xl border focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white ${
                              emailTouched && !isEmailValid ? 'border-red-400 bg-red-50/30' : 'border-slate-200'
                            }`}
                          />
                          {coachEmail && isEmailValid && (
                            <Check className="absolute right-3 top-3.5 w-4 h-4 text-emerald-500 font-bold" />
                          )}
                          {emailTouched && !isEmailValid && coachEmail && (
                            <AlertCircle className="absolute right-3 top-3.5 w-4 h-4 text-red-400" />
                          )}
                        </div>
                        {emailTouched && !isEmailValid && coachEmail && (
                          <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Please enter a valid email address
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Phone Number <span className="text-red-500">*</span></label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 flex items-center gap-1 text-slate-500 text-sm">
                            <span>🇮🇳</span>
                            <span className="font-medium text-xs text-slate-500">+91</span>
                          </span>
                          <input
                            type="tel"
                            required
                            value={coachPhone}
                            onChange={(e) => setCoachPhone(e.target.value.replace(/\D/g, ''))}
                            onBlur={() => setPhoneTouched(true)}
                            maxLength={10}
                            placeholder="98765 43210"
                            className={`w-full h-11 pl-14 pr-10 rounded-xl border focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white ${
                              phoneTouched && !isPhoneValid ? 'border-red-400 bg-red-50/30' : 'border-slate-200'
                            }`}
                          />
                          {isPhoneValid && (
                            <Check className="absolute right-3 w-4 h-4 text-emerald-500 font-bold" />
                          )}
                          {phoneTouched && !isPhoneValid && coachPhone && (
                            <AlertCircle className="absolute right-3 w-4 h-4 text-red-400" />
                          )}
                        </div>
                        {phoneTouched && !isPhoneValid && coachPhone && (
                          <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Enter a valid 10-digit mobile number
                          </p>
                        )}
                        {!phoneTouched && <p className="text-[10px] text-slate-400 mt-1">You will receive an OTP to verify your phone number.</p>}
                      </div>
                    </div>

                    {/* Gender & Date of Birth */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Gender <span className="text-red-500">*</span></label>
                        <select
                          required
                          value={coachGender}
                          onChange={(e) => setCoachGender(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        >
                          <option value="">Select gender...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Date of Birth <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          required
                          value={coachDOB}
                          onChange={(e) => setCoachDOB(e.target.value)}
                          max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        />
                        <p className="text-[10px] text-slate-400">Must be at least 18 years old</p>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1">
                      <label className="text-slate-700 text-xs font-bold block">Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type={coachShowPassword ? 'text' : 'password'}
                          required
                          value={coachPassword}
                          onChange={(e) => setCoachPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setCoachShowPassword(!coachShowPassword)}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {coachShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Password Criteria Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            coachHasLength ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                          <span className={coachHasLength ? 'text-emerald-700' : ''}>At least 8 characters</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            coachHasUppercase ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                          <span className={coachHasUppercase ? 'text-emerald-700' : ''}>One uppercase letter</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            coachHasNumber ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                          <span className={coachHasNumber ? 'text-emerald-700' : ''}>One number</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            coachHasSpecial ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                          <span className={coachHasSpecial ? 'text-emerald-700' : ''}>One special character</span>
                        </div>
                      </div>
                    </div>

                    {/* Location fields moved to Step 1 */}
                    <div className="border-t border-slate-100 pt-5 mt-5 space-y-4">
                      <h4 className="text-sm font-bold text-slate-900">Address & Location Details</h4>
                      
                      {/* Country dropdown */}
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Country <span className="text-red-500">*</span></label>
                        <select
                          value={coachCountry}
                          onChange={(e) => setCoachCountry(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        >
                          <option value="India">India</option>
                          <option value="USA">United States</option>
                          <option value="UK">United Kingdom</option>
                          <option value="Canada">Canada</option>
                          <option value="Australia">Australia</option>
                        </select>
                      </div>

                      {/* State & City Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-slate-700 text-xs font-bold block">State <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            required
                            value={coachState}
                            onChange={(e) => setCoachState(e.target.value)}
                            placeholder="e.g. Karnataka"
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-700 text-xs font-bold block">City <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            required
                            value={coachCity}
                            onChange={(e) => setCoachCity(e.target.value)}
                            placeholder="e.g. Bangalore"
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                          />
                        </div>
                      </div>

                      {/* Area / Locality */}
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Area / Locality <span className="text-slate-400 font-normal">(Optional)</span></label>
                        <input
                          type="text"
                          value={coachArea}
                          onChange={(e) => setCoachArea(e.target.value)}
                          placeholder="e.g. Indiranagar"
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        />
                      </div>

                      {/* Full Address */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-slate-700 text-xs font-bold block">Full Address (Optional)</label>
                          <span className="text-[10px] font-semibold text-slate-400">{coachAddress.length}/200</span>
                        </div>
                        <textarea
                          rows={3}
                          maxLength={200}
                          value={coachAddress}
                          onChange={(e) => setCoachAddress(e.target.value)}
                          placeholder="Enter your street address, apartment number, and postal code..."
                          className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------- STEP 2 ----------------- */}
                {coachStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-900">
                          Tell us about your professional background
                        </h3>
                        <span className="text-[10px] font-semibold text-red-500">* Required fields</span>
                      </div>
                    </div>

                    {/* Skill & Specialization */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Primary Skill / Subject <span className="text-red-500">*</span></label>
                        <select
                          value={primarySkill}
                          onChange={(e) => setPrimarySkill(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        >
                          {PRIMARY_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Specialization <span className="text-red-500">*</span></label>
                        <select
                          value={specialization}
                          onChange={(e) => setSpecialization(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        >
                          {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Experience & Qualification */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Experience (in years) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 text-xs font-bold block">Qualification <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={qualification}
                          onChange={(e) => setQualification(e.target.value)}
                          placeholder="e.g. B.P.Ed, NIS Certified"
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white"
                        />
                      </div>
                    </div>

                    {/* Languages tag list */}
                    <div className="space-y-1.5">
                      <label className="text-slate-700 text-xs font-bold block">Languages Known</label>
                      <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-xl bg-slate-50/50 min-h-[44px] items-center">
                        {languagesKnown.map(lang => (
                          <span key={lang} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                            {lang}
                            <button type="button" onClick={() => removeLanguage(lang)} className="text-indigo-400 hover:text-indigo-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={langInput}
                          onChange={(e) => setLangInput(e.target.value)}
                          onKeyDown={addLanguage}
                          placeholder="Type and press Enter"
                          className="flex-1 min-w-[120px] bg-transparent outline-none border-none text-sm text-slate-800 px-1 py-0.5"
                        />
                      </div>
                      {/* Common languages pills helper */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {LANGUAGES.filter(l => !languagesKnown.includes(l)).map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setLanguagesKnown([...languagesKnown, l])}
                            className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[10px] text-slate-500 font-medium transition-colors"
                          >
                            + {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Service Types */}
                    <div className="space-y-1.5">
                      <label className="text-slate-700 text-xs font-bold block">Service Types <span className="text-red-500">*</span> <span className="text-slate-400 font-normal">(Select all that apply)</span></label>
                      <div className="flex flex-wrap gap-2">
                        {SERVICE_TYPES.map(svc => {
                          const isSelected = serviceTypes.includes(svc.value);
                          return (
                            <button
                              key={svc.value}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setServiceTypes(serviceTypes.filter(s => s !== svc.value));
                                } else {
                                  setServiceTypes([...serviceTypes, svc.value]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              {svc.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Class Types */}
                    <div className="space-y-1.5">
                      <label className="text-slate-700 text-xs font-bold block">Class Types <span className="text-red-500">*</span> <span className="text-slate-400 font-normal">(Select all that apply)</span></label>
                      <div className="flex flex-wrap gap-2">
                        {CLASS_TYPES.map(cls => {
                          const isSelected = classTypes.includes(cls.value);
                          return (
                            <button
                              key={cls.value}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setClassTypes(classTypes.filter(c => c !== cls.value));
                                } else {
                                  setClassTypes([...classTypes, cls.value]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              {cls.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-700 text-xs font-bold block">Bio</label>
                        <span className="text-[10px] font-semibold text-slate-400">{bio.length}/500</span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell students about your coaching style and goals..."
                        className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none text-sm text-slate-800 bg-white resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                )}

                {/* ----------------- STEP 3: DOCUMENTS ----------------- */}
                {coachStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-900">
                          Upload your documents
                        </h3>
                        <span className="text-[10px] font-semibold text-red-500">* Required</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Upload identity proof and relevant certificates. You can also upload these later from your profile.</p>
                    </div>

                    <div className="space-y-3">
                      {DOCUMENT_TYPES.map((doc) => {
                        const file = docFiles[doc.key];
                        return (
                          <div key={doc.key} className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4 bg-white hover:border-indigo-200 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span className="text-sm font-semibold text-slate-800">
                                  {doc.label}
                                  {doc.required && <span className="text-red-500 ml-1">*</span>}
                                  {!doc.required && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(Optional)</span>}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 ml-5.5">{doc.hint}</p>
                              {file && (
                                <p className="text-[11px] text-emerald-600 font-semibold mt-1 ml-5.5 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> {file.name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {file && (
                                <button
                                  type="button"
                                  onClick={() => setDocFiles(prev => ({ ...prev, [doc.key]: null }))}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                file 
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                  : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              }`}>
                                <Upload className="w-3.5 h-3.5" />
                                {file ? 'Replace' : 'Upload'}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) setDocFiles(prev => ({ ...prev, [doc.key]: f }));
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <span>Documents marked <strong>*</strong> are required for account approval. You can still complete registration and upload them later from your profile page.</span>
                    </div>
                  </div>
                )}



                {/* ----------------- STEP 4 ----------------- */}
                {coachStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        Secure your account
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">
                        We'll help you secure your account with verification.
                      </p>
                    </div>

                    {/* Phone Verification Box - Disabled */}
                    <div className="border border-slate-100 bg-slate-50/50 p-6 rounded-2xl relative space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-200/50 flex items-center justify-center text-slate-400">
                            <Phone className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-400">Phone Verification</h4>
                            <p className="text-[11px] text-slate-400 font-medium">
                              We've sent a verification OTP to +91 {coachPhone || '98765 43210'}
                            </p>
                          </div>
                        </div>
                        <button disabled className="text-slate-300 text-xs font-bold flex items-center gap-1 cursor-not-allowed">
                          Edit
                        </button>
                      </div>

                      {/* Mocked OTP Grid */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {[4, 9, 2, 8, 1, 6].map((num, i) => (
                            <input
                              key={i}
                              disabled
                              type="text"
                              maxLength={1}
                              value={num}
                              className="w-10 h-10 text-center text-sm bg-slate-100/50 border border-slate-200 rounded-xl font-semibold text-slate-400 cursor-not-allowed"
                            />
                          ))}
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          Verified
                        </span>
                      </div>

                      <div className="text-[10px] font-semibold text-slate-300">
                        Resend OTP in 00:45
                      </div>
                    </div>

                    {/* Email Verification Box - Mocked */}
                    <div className="border border-slate-100 bg-slate-50/50 p-6 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-200/50 flex items-center justify-center text-slate-400">
                            <Mail className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-400">Email Verification</h4>
                            <p className="text-[11px] text-slate-400 font-medium">
                              We've sent a verification link to {coachEmail || 'rohan.sharma@example.com'}
                            </p>
                          </div>
                        </div>
                        <button disabled className="text-slate-300 text-xs font-bold flex items-center gap-1 cursor-not-allowed">
                          Edit
                        </button>
                      </div>

                      {/* verified banner */}
                      <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-xs text-emerald-800 font-medium">Verified. Email verified successfully</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------- STEP 5 ----------------- */}
                {coachStep === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        Review your information
                      </h3>
                    </div>

                    {/* Summary Cards */}
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                      
                      {/* Card 1: Personal Info */}
                      <div className="border border-slate-100 bg-slate-50/50 p-5 rounded-2xl relative">
                        <button
                          type="button"
                          onClick={() => setCoachStep(1)}
                          className="absolute top-5 right-5 text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          Edit
                        </button>
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 font-sans">
                          Personal Information
                        </h4>
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            {onboardPhotoPreview ? (
                              <img src={onboardPhotoPreview} className="w-full h-full object-cover" alt="Avatar" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><User className="w-7 h-7 text-slate-400" /></div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs flex-1">
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Name</span>
                              <span className="text-slate-700 font-normal">{coachFirstName} {coachLastName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Email</span>
                              <span className="text-slate-700 font-normal">{coachEmail}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-medium">Phone</span>
                              <span className="text-slate-700 font-normal">+91 {coachPhone}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Professional Profile */}
                      <div className="border border-slate-100 bg-slate-50/50 p-5 rounded-2xl relative">
                        <button
                          type="button"
                          onClick={() => setCoachStep(2)}
                          className="absolute top-5 right-5 text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          Edit
                        </button>
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 font-sans">
                          Professional Profile
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs">
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">Primary Skill</span>
                            <span className="text-slate-700 font-normal">{primarySkill}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">Specialization</span>
                            <span className="text-slate-700 font-normal">{specialization}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">Experience</span>
                            <span className="text-slate-700 font-normal">{experienceYears} Years</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">Qualification</span>
                            <span className="text-slate-700 font-normal">{qualification}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-400 block mb-0.5 font-medium">Languages</span>
                            <span className="text-slate-700 font-normal">{languagesKnown.join(', ')}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-400 block mb-0.5 font-medium">Service Types</span>
                            <span className="text-slate-700 font-normal">{serviceTypes.join(', ')}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-400 block mb-0.5 font-medium">Class Types</span>
                            <span className="text-slate-700 font-normal">{classTypes.join(', ')}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-400 block mb-0.5 font-medium">Bio</span>
                            <span className="text-slate-700 font-normal leading-relaxed block max-w-xl whitespace-pre-wrap">{bio}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Location */}
                      <div className="border border-slate-100 bg-slate-50/50 p-5 rounded-2xl relative">
                        <button
                          type="button"
                          onClick={() => setCoachStep(1)}
                          className="absolute top-5 right-5 text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          Edit
                        </button>
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 font-sans">
                          Location
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">Country</span>
                            <span className="text-slate-700 font-normal">{coachCountry}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">State</span>
                            <span className="text-slate-700 font-normal">{coachState}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">City</span>
                            <span className="text-slate-700 font-normal">{coachCity}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 font-medium">Area / Locality</span>
                            <span className="text-slate-700 font-normal">{coachArea}</span>
                          </div>
                          {coachAddress && (
                            <div className="sm:col-span-2">
                              <span className="text-slate-400 block mb-0.5 font-medium">Full Address</span>
                              <span className="text-slate-700 font-normal leading-relaxed block max-w-xl">{coachAddress}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Warning note banner */}
                    <div className="bg-indigo-50 border border-indigo-100/50 p-4 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed text-indigo-800 font-normal">
                        Once you submit, your profile will be reviewed by the academy admin. You will be notified once your account is activated.
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Buttons navigation bar */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6 shrink-0">
                  {coachStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setCoachStep(coachStep - 1)}
                      className="inline-flex items-center px-5 py-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                      Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {coachStep < 5 ? (
                    <button
                      type="button"
                      onClick={() => setCoachStep(coachStep + 1)}
                      disabled={
                        (coachStep === 1 && !isStep1Valid) ||
                        (coachStep === 2 && !isStep2Valid) ||
                        (coachStep === 3 && !isStep3Valid)
                      }
                      className="inline-flex items-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save & Continue
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCoachRegisterSubmit}
                      disabled={loading}
                      className="inline-flex items-center px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                      ) : (
                        <Check className="w-4 h-4 mr-1.5 font-bold" />
                      )}
                      Submit & Complete Onboarding
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ORIGINAL ACADEMY ONBOARDING LAYOUT (DARK)
  // ----------------------------------------------------
  return (
    <div className="relative min-h-screen flex items-center justify-center py-12 px-4 overflow-hidden">
      {/* Background Animated Nodes */}
      <div className="radial-mesh-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pulsing-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pulsing-glow" style={{ animationDelay: '-4s' }} />

      <div className="w-full max-w-lg glass-panel p-8 rounded-3xl relative z-10">
        {/* Logo/Branding Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-400 text-xs font-semibold tracking-wider uppercase mb-3 glow-indigo">
            <Sparkles className="w-3.5 h-3.5" />
            Academy Onboarding
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight glow-text-indigo font-sans">
            Register Your Academy
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            SaaS attendance & payment management starting at ₹0/month
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        {isTestMode && (
          <div className="mb-4 p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl flex items-center justify-between animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-xs text-purple-300 font-bold tracking-wide uppercase text-[10px]">Test Mode Active</span>
            </div>
            <button
              type="button"
              onClick={fillRandomAcademyData}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <span>⚡ Auto-fill Test Data</span>
            </button>
          </div>
        )}

        <form onSubmit={handleAcademyRegister} className="space-y-4">
          <div className="border-b border-white/10 pb-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-300">1. Academy Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Institute Name */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Institute / Academy Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Building2 className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  placeholder="Elite Swimming Academy"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Institute Slug */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Subdomain Slug
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Globe className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="eliteswim"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs text-indigo-300 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Country, State, City Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Country */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Country
              </label>
              <input
                type="text"
                required
                value={academyCountry}
                onChange={(e) => setAcademyCountry(e.target.value)}
                placeholder="India"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>

            {/* State */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                State
              </label>
              <input
                type="text"
                required
                value={academyState}
                onChange={(e) => setAcademyState(e.target.value)}
                placeholder="Telangana"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>

            {/* City */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                City
              </label>
              <input
                type="text"
                required
                value={academyCity}
                onChange={(e) => setAcademyCity(e.target.value)}
                placeholder="Hyderabad"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-semibold block">
              Academy Physical Address (Optional)
            </label>
            <input
              type="text"
              value={academyAddress}
              onChange={(e) => setAcademyAddress(e.target.value)}
              placeholder="e.g. Plot No. 45, Jubilee Hills"
              className="w-full h-10 px-4 rounded-xl glass-input text-xs"
            />
          </div>

          <div className="border-b border-white/10 pt-2 pb-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-300">2. Owner / Admin Account</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                First Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={academyFirstName}
                  onChange={(e) => setAcademyFirstName(e.target.value)}
                  placeholder="Arjun"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Last Name */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Last Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={academyLastName}
                  onChange={(e) => setAcademyLastName(e.target.value)}
                  placeholder="Sharma"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={academyEmail}
                  onChange={(e) => setAcademyEmail(e.target.value)}
                  placeholder="arjun@elite.com"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={academyPhone}
                onChange={(e) => setAcademyPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-semibold block">
              Choose Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={academyShowPassword ? 'text' : 'password'}
                required
                value={academyPassword}
                onChange={(e) => setAcademyPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full h-10 pl-9 pr-10 rounded-xl glass-input text-xs"
              />
              <button
                type="button"
                onClick={() => setAcademyShowPassword(!academyShowPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
              >
                {academyShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl btn-premium font-bold text-sm tracking-wide mt-4 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Onboard Academy & Log In'
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an academy account?{' '}
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
