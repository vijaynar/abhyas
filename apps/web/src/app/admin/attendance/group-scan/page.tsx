// apps/web/src/app/admin/attendance/group-scan/page.tsx
'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  User,
  Users,
  Check,
  X,
  Info,
  Calendar,
  Zap,
  CalendarCheck2,
  Plus
} from 'lucide-react';

let faceapi: any = null;
const MODELS_CDN_URL = '/models';

interface EnrolledStudent {
  id: string;
  student_custom_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface BatchItem {
  id: string;
  name: string;
  classes: {
    name: string;
  } | null;
}

interface MatchedStudent {
  id: string;
  name: string;
  studentCustomId: string;
  similarity: number;
  status: 'present' | 'late' | 'absent';
  logId: string;
}

interface AbsentStudent {
  id: string;
  name: string;
  studentCustomId: string;
  status: 'absent';
  logId: string;
}

interface UploadedImage {
  dataUrl: string;
  embeddings: number[][];
  boxes: any[];
  detections: any[];
  analyzed: boolean;
}

function dataURLtoBlob(dataurl: string) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function GroupScanContent() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [batchStudents, setBatchStudents] = useState<EnrolledStudent[]>([]);
  
  // Model loading and state
  const [loadingModels, setLoadingModels] = useState(true);
  const [isSimulator, setIsSimulator] = useState(false);
  const [forceSimulator, setForceSimulator] = useState(false);
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  
  // Image & Canvas state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(-1);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);

  // Scan Results state
  const [matchedStudents, setMatchedStudents] = useState<MatchedStudent[]>([]);
  const [absentStudents, setAbsentStudents] = useState<AbsentStudent[]>([]);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  
  // UI states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Scanned Status & History states
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Computed property to maintain code compatibility
  const uploadedImage = activeImageIndex >= 0 && activeImageIndex < uploadedImages.length
    ? uploadedImages[activeImageIndex].dataUrl
    : null;

  // 1. Load Batches
  useEffect(() => {
    async function loadBatches() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('users')
          .select('tenant_id, role')
          .eq('id', user.id)
          .single();

        if (!profile) return;

        let batchData;
        if (profile.role === 'coach') {
          // Only show approved batches assigned to this coach
          const { data: assigned } = await supabase
            .from('coach_batch_assignments')
            .select('batch_id, batches(id, name, classes(name))')
            .eq('coach_id', user.id)
            .eq('status', 'approved');

          batchData = (assigned || [])
            .map((a: any) => a.batches)
            .filter(Boolean);
        } else {
          // Admins/Superadmins get all batches
          const { data } = await supabase
            .from('batches')
            .select('id, name, classes(name)')
            .eq('tenant_id', profile.tenant_id)
            .order('name', { ascending: true });
          batchData = data || [];
        }

        const loadedBatches = (batchData || []) as unknown as BatchItem[];
        setBatches(loadedBatches);
        if (loadedBatches.length > 0) {
          setSelectedBatch(loadedBatches[0].id);
        }
      } catch (err) {
        console.error('Failed to load batches:', err);
      }
    }
    loadBatches();
  }, [supabase]);

  // Check for existing photo uploads for this session
  useEffect(() => {
    if (!selectedBatch || !selectedDate) return;

    async function checkExistingPhotos() {
      setCheckingExisting(true);
      try {
        const { data, error } = await supabase
          .from('group_attendance_photos')
          .select('photo_url')
          .eq('batch_id', selectedBatch)
          .eq('date', selectedDate);
        if (error) throw error;
        setExistingPhotos((data || []).map((p: any) => p.photo_url));
      } catch (err) {
        console.error('Failed to check existing photos:', err);
      } finally {
        setCheckingExisting(false);
      }
    }

    checkExistingPhotos();
  }, [selectedBatch, selectedDate, supabase]);

  const deletePhoto = (index: number) => {
    setUploadedImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      
      // Reset analysis status so they re-analyze the remaining photos
      const resetImages = next.map(img => ({
        ...img,
        detections: [],
        analyzed: false
      }));

      // Adjust active index
      if (resetImages.length === 0) {
        setActiveImageIndex(-1);
      } else {
        setActiveImageIndex((prevIndex) => {
          if (prevIndex >= resetImages.length) return resetImages.length - 1;
          return prevIndex;
        });
      }

      setAnalyzed(false);
      setMatchedStudents([]);
      setAbsentStudents([]);
      setUnrecognizedCount(0);

      return resetImages;
    });
  };

  const clearAllPhotos = () => {
    setUploadedImages([]);
    setActiveImageIndex(-1);
    setAnalyzed(false);
    setMatchedStudents([]);
    setAbsentStudents([]);
    setUnrecognizedCount(0);
    setErrorMsg(null);
  };

  // 2. Load enrolled students for the selected batch
  useEffect(() => {
    if (!selectedBatch) return;

    async function loadBatchStudents() {
      try {
        const { data: studentsData, error } = await supabase
          .from('students')
          .select('id, student_custom_id, users(first_name, last_name, email)')
          .eq('batch_id', selectedBatch);

        if (error) throw error;

        const mapped = (studentsData || []).map((s: any) => ({
          id: s.id,
          student_custom_id: s.student_custom_id,
          first_name: s.users?.first_name || '',
          last_name: s.users?.last_name || '',
          email: s.users?.email || '',
        }));

        setBatchStudents(mapped);
      } catch (err) {
        console.error('Failed to load batch students:', err);
      }
    }

    loadBatchStudents();
  }, [selectedBatch, supabase]);

  // 3. Load face-api.js models client-side
  useEffect(() => {
    let active = true;

    async function loadFaceApi() {
      try {
        setLoadingModels(true);
        faceapi = await import('face-api.js');

        // Load models
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_CDN_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_CDN_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_CDN_URL)
        ]);

        if (active) {
          setLoadingModels(false);
          console.log('FaceAPI.js models loaded successfully.');
        }
      } catch (err: any) {
        console.error('Failed to load FaceAPI models from CDN, activating simulator backup:', err);
        if (active) {
          setIsSimulator(true);
          setForceSimulator(true); // auto-enable simulation if models fail to load
          setLoadingModels(false);
        }
      }
    }

    loadFaceApi();

    return () => {
      active = false;
    };
  }, []);

  // Web Camera Stream Effect
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    async function startCamera() {
      if (!showCamera) return;
      setCameraLoading(true);
      setErrorMsg(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
        });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to access camera:', err);
        setErrorMsg('Camera access was denied or is not available. Please verify browser permissions.');
        setShowCamera(false);
      } finally {
        setCameraLoading(false);
      }
    }
    
    startCamera();
    
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCamera]);

  // 4. Handle Drag & Drop / File Select Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setShowCamera(false);

    // Read files and add them to uploadedImages list
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setUploadedImages((prev) => {
          const newImg: UploadedImage = {
            dataUrl,
            embeddings: [],
            boxes: [],
            detections: [],
            analyzed: false,
          };
          const next = [...prev, newImg];
          if (next.length === 1) {
            setActiveImageIndex(0);
          }
          return next;
        });
      };
      reader.readAsDataURL(file);
    });

    setAnalyzed(false);
    setMatchedStudents([]);
    setAbsentStudents([]);
    setUnrecognizedCount(0);
  };

  // Capture photo from web camera frame
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      setErrorMsg(null);
      
      setUploadedImages((prev) => {
        const newImg: UploadedImage = {
          dataUrl,
          embeddings: [],
          boxes: [],
          detections: [],
          analyzed: false,
        };
        const next = [...prev, newImg];
        setActiveImageIndex(next.length - 1);
        return next;
      });

      setAnalyzed(false);
      setMatchedStudents([]);
      setAbsentStudents([]);
      setUnrecognizedCount(0);
      setShowCamera(false);
    }
  };

  // 5. Run Face Analysis
  const handleAnalyzePhoto = async () => {
    if (activeImageIndex < 0 || activeImageIndex >= uploadedImages.length || !imageRef.current || !canvasRef.current) return;
    setAnalyzing(true);
    setErrorMsg(null);
    setScanningProgress(10);

    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Wait for image tag to be fully loaded in the DOM
    if (!img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
      });
    }

    const imgWidth = img.clientWidth || img.naturalWidth;
    const imgHeight = img.clientHeight || img.naturalHeight;

    if (imgWidth === 0 || imgHeight === 0) {
      setAnalyzing(false);
      setErrorMsg('Failed to resolve image dimensions. Please try another photo or recapture.');
      return;
    }

    // Simulate progress updates for scanning HUD laser animation
    const progressInterval = setInterval(() => {
      setScanningProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      let activeEmbeddings: number[][] = [];
      let activeBoxes: any[] = [];

      if (isSimulator || forceSimulator || !faceapi) {
        // High fidelity simulation
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // Select students from the batch to simulate matching. If none enrolled, generate mock targets.
        let studentsToMatch = [...batchStudents];
        if (studentsToMatch.length === 0) {
          studentsToMatch = [
            { id: 'mock-1', student_custom_id: 'vs00001', first_name: 'Arjun', last_name: 'Sharma', email: 'arjun@gmail.com' },
            { id: 'mock-2', student_custom_id: 'vs00002', first_name: 'Kabir', last_name: 'Dev', email: 'kabir@gmail.com' },
            { id: 'mock-3', student_custom_id: 'vs00003', first_name: 'Riya', last_name: 'Mehta', email: 'riya@gmail.com' }
          ];
        }

        studentsToMatch = studentsToMatch
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(studentsToMatch.length, Math.floor(Math.random() * 2) + 2));

        studentsToMatch.forEach((student, index) => {
          const boxWidth = Math.floor(imgWidth * 0.14);
          const boxHeight = Math.floor(imgWidth * 0.14);
          const x = Math.floor(imgWidth * (0.2 + index * 0.3) - boxWidth / 2);
          const y = Math.floor(imgHeight * (0.35 + (index % 2) * 0.1) - boxHeight / 2);

          activeBoxes.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            x,
            y,
            w: boxWidth,
            h: boxHeight,
          });

          // Generate a random 128-float unit vector embedding
          const raw = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
          const magnitude = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
          activeEmbeddings.push(raw.map((v) => v / magnitude));
        });

        // Add 1 extra mock unrecognized face to simulate real world conditions
        activeBoxes.push({
          studentId: null,
          name: 'Unrecognized Face',
          x: Math.floor(imgWidth * 0.75),
          y: Math.floor(imgHeight * 0.55),
          w: Math.floor(imgWidth * 0.12),
          h: Math.floor(imgWidth * 0.12),
        });
        const raw = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
        const magnitude = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
        activeEmbeddings.push(raw.map((v) => v / magnitude));

      } else {
        // Real client-side face detection using face-api.js
        const tempCanvas = faceapi.createCanvasFromMedia(img);
        const displaySize = { width: imgWidth, height: imgHeight };
        faceapi.matchDimensions(tempCanvas, displaySize);

        const detections = await faceapi
          .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (!detections || detections.length === 0) {
          clearInterval(progressInterval);
          setAnalyzing(false);
          setErrorMsg('No faces detected in this photo. Please ensure faces are fully visible, clear, and well-lit. Alternatively, enable "AI Simulation Mode" to bypass.');
          return;
        }

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        resizedDetections.forEach((det: any) => {
          activeEmbeddings.push(Array.from(det.descriptor));
          const box = det.detection.box;
          activeBoxes.push({
            studentId: null,
            name: 'Scanning...',
            x: box.x,
            y: box.y,
            w: box.width,
            h: box.height,
          });
        });
      }

      clearInterval(progressInterval);
      setScanningProgress(100);

      // Now combine embeddings from all OTHER analyzed images plus this active one
      const combinedEmbeddings: number[][] = [];
      uploadedImages.forEach((imgItem, idx) => {
        if (idx === activeImageIndex) {
          combinedEmbeddings.push(...activeEmbeddings);
        } else if (imgItem.analyzed) {
          combinedEmbeddings.push(...imgItem.embeddings);
        }
      });

      // Match face embeddings via server endpoint
      const response = await fetch('/api/v1/attendance/match-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatch,
          date: selectedDate,
          embeddings: combinedEmbeddings,
          simulate: isSimulator || forceSimulator,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Server matching request failed');
      }

      const payload = result.data || result; // Safely read from ok wrapped payload
      setMatchedStudents(payload.matchedStudents || []);
      setAbsentStudents(payload.absentStudents || []);
      setUnrecognizedCount(payload.unrecognizedCount || 0);

      // Distribute payload.detections back to the respective images
      let startIndex = 0;
      setUploadedImages((prev) => {
        return prev.map((imgItem, idx) => {
          if (idx === activeImageIndex) {
            const mappedDetections = payload.detections.slice(startIndex, startIndex + activeEmbeddings.length);
            startIndex += activeEmbeddings.length;
            return {
              ...imgItem,
              embeddings: activeEmbeddings,
              boxes: activeBoxes,
              detections: mappedDetections,
              analyzed: true,
            };
          } else if (imgItem.analyzed) {
            const mappedDetections = payload.detections.slice(startIndex, startIndex + imgItem.embeddings.length);
            startIndex += imgItem.embeddings.length;
            return {
              ...imgItem,
              detections: mappedDetections,
            };
          }
          return imgItem;
        });
      });

      setAnalyzed(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Face matching endpoint failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthenticated');

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');
      const tenantId = profile.tenant_id;

      // Filter to only uploaded images that have been analyzed
      const analyzedImages = uploadedImages.filter(img => img.analyzed);
      if (analyzedImages.length === 0) {
        throw new Error('No analyzed photos to save. Please scan the photos first.');
      }

      // Upload all analyzed photos to storage and insert to group_attendance_photos
      for (let i = 0; i < analyzedImages.length; i++) {
        const img = analyzedImages[i];
        
        // Convert base64 dataUrl to Blob
        const blob = dataURLtoBlob(img.dataUrl);
        const fileExt = blob.type.split('/')[1] || 'jpg';
        
        // Construct file name path
        const fileName = `${tenantId}/${selectedBatch}/${selectedDate}/${Date.now()}-${i}.${fileExt}`;
        
        // Upload to bucket 'attendance-photos'
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('attendance-photos')
          .upload(fileName, blob, {
            contentType: blob.type,
            upsert: true
          });

        if (uploadErr) {
          console.error('Storage upload failed:', uploadErr);
          throw new Error(`Failed to upload photo #${i + 1}: ${uploadErr.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('attendance-photos')
          .getPublicUrl(fileName);
        
        if (!urlData || !urlData.publicUrl) {
          throw new Error(`Failed to get public URL for photo #${i + 1}`);
        }

        const photoUrl = urlData.publicUrl;

        // Insert into group_attendance_photos
        const { error: insertErr } = await supabase
          .from('group_attendance_photos')
          .insert({
            tenant_id: tenantId,
            batch_id: selectedBatch,
            date: selectedDate,
            photo_url: photoUrl
          });

        if (insertErr) {
          console.error('DB insert failed:', insertErr);
          throw new Error(`Failed to save record for photo #${i + 1}: ${insertErr.message}`);
        }
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push('/admin/attendance');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save attendance photos.');
      setSubmitting(false);
    }
  };

  // Redraw canvas whenever active image or its detections change
  useEffect(() => {
    if (activeImageIndex < 0 || activeImageIndex >= uploadedImages.length || !imageRef.current || !canvasRef.current) {
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const activeImg = uploadedImages[activeImageIndex];
    if (!activeImg.analyzed) {
      // Clear canvas if not analyzed
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const drawCanvas = () => {
      const imgWidth = img.clientWidth || img.naturalWidth;
      const imgHeight = img.clientHeight || img.naturalHeight;
      if (imgWidth === 0 || imgHeight === 0) return;

      canvas.width = imgWidth;
      canvas.height = imgHeight;

      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 3;

        activeImg.boxes.forEach((box, idx) => {
          let label = 'Unrecognized Face';
          let color = '#ef4444'; // Red glow for unrecognized

          const det = activeImg.detections?.[idx];
          if (det && det.matched) {
            label = `${det.name} (${Math.round(det.similarity)}%)`;
            color = '#10b981'; // Green glow for matching students
          }

          // Draw Glowing Face HUD Bounding Box
          ctx.strokeStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          // Draw Neon Tag Label Background
          ctx.shadowBlur = 0;
          ctx.fillStyle = color;
          ctx.fillRect(box.x - 1.5, box.y + box.h, box.w + 3, 20);

          // Draw Text Label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(
            label.length > 20 ? label.substring(0, 18) + '..' : label,
            box.x + 5,
            box.y + box.h + 13
          );
        });
      }
    };

    if (img.complete) {
      drawCanvas();
    } else {
      img.onload = drawCanvas;
    }
  }, [activeImageIndex, uploadedImages]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Title Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/attendance')}
          className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> AI Biometric Attendance
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Daily Group Photo Analyzer
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Automatic batch recognition and auto-fines logging portal.
          </p>
        </div>
      </div>

      {(isSimulator || forceSimulator) && (
        <div className="p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 text-indigo-300 text-xs flex items-center gap-3.5 animate-pulse">
          <Zap className="w-5 h-5 flex-shrink-0 glow-indigo" />
          <div>
            <span className="font-extrabold block">High-Fidelity Simulator Active</span>
            <span className="opacity-80">WebGL neural engine running mock landmarks and roster matching. Perfect for instant sandboxed trial verification!</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Selector, Image Viewport, Sidebar Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Span: Selectors and Image Processing */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Settings Panel */}
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            {/* Scanned Status Check */}
            {checkingExisting ? (
              <div className="p-3.5 rounded-2xl border border-white/5 bg-slate-900/40 text-slate-400 text-xs flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Checking attendance upload history for this batch...</span>
              </div>
            ) : existingPhotos.length > 0 ? (
              <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Attendance Photos Already Uploaded</span>
                    <span className="opacity-80 block">You have already uploaded and scanned {existingPhotos.length} group photo(s) for this session today.</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-500/10">
                  {existingPhotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative group w-14 h-14 rounded-lg overflow-hidden border border-emerald-500/20 bg-slate-900 cursor-pointer">
                      <img src={url} alt={`Previous Scan ${i+1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-bold text-white">View</div>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <span className="font-bold block">No Attendance Photos Scanned Today</span>
                  <span className="opacity-80 block">Please capture or upload session photos to record attendance.</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Target Active Batch
                </label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
                  disabled={analyzing || analyzed}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.classes ? `(${b.classes.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
                  disabled={analyzing || analyzed}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-white/5">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs bg-indigo-500/5 border border-indigo-500/10 h-8 px-3 rounded-xl">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>{batchStudents.length} Students Enrolled</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  AI Simulation Mode
                  <span className="group relative cursor-pointer text-slate-500 hover:text-slate-300">
                    <Info className="w-3.5 h-3.5" />
                    <span className="absolute bottom-full right-0 mb-2 w-64 p-2.5 rounded-lg border border-white/10 bg-slate-950 text-[10px] text-slate-400 font-normal leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl z-30">
                      Simulates biometric scans offline using mock bounding boxes and rosters. Useful when face-api model weights fail to load locally, or for instant testing.
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (analyzing || analyzed) return;
                    setForceSimulator(!forceSimulator);
                  }}
                  disabled={analyzing || analyzed}
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                    forceSimulator ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-200 ${
                      forceSimulator ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Photo Viewport Container */}
          <div className="relative aspect-[4/3] rounded-3xl bg-slate-950 overflow-hidden border border-white/10 flex items-center justify-center">
            
            {loadingModels && !isSimulator && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4 bg-slate-950 z-20">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin glow-indigo" />
                <div>
                  <h4 className="text-sm font-bold text-white">Initializing Neural Engine</h4>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[240px]">Downloading face-api weights maps (SSD Mobilenet & landmarks)...</p>
                </div>
              </div>
            )}

            {cameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4 bg-slate-950 z-20">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin glow-indigo" />
                <div>
                  <h4 className="text-sm font-bold text-white">Starting Video Capture</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Connecting to hardware camera stream...</p>
                </div>
              </div>
            )}

            {analyzing && (
              <div className="absolute inset-0 bg-indigo-500/5 flex flex-col items-center justify-center z-10 pointer-events-none">
                <div className="w-full h-1.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-indigo-500/0 absolute animate-[bounce_2s_infinite]" />
                <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest mt-24 bg-slate-900/90 px-4 py-1.5 rounded-full border border-indigo-500/20">
                  Scanning Group Face Landmarks... {scanningProgress}%
                </p>
              </div>
            )}

            {submitSuccess && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center z-30 space-y-3.5 animate-in fade-in duration-200">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 glow-emerald">
                  <CalendarCheck2 className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Batch Attendance Logged</h3>
                  <p className="text-xs text-slate-400 mt-1">Successfully synced logs and auto-fines to ledger database.</p>
                </div>
              </div>
            )}

            {showCamera ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Holographic scanner guide overlay */}
                <div className="absolute inset-0 border-[24px] border-slate-950/80 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-48 border border-dashed border-indigo-500/40 rounded-3xl relative">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-500" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-500" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-500" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-500" />
                  </div>
                </div>

                <div className="absolute bottom-5 inset-x-0 flex justify-center gap-3">
                  <button
                    onClick={capturePhoto}
                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 glow-indigo shadow-lg"
                  >
                    <Camera className="w-4 h-4" /> Capture Photo
                  </button>
                  <button
                    onClick={() => setShowCamera(false)}
                    className="h-10 px-4 rounded-xl border border-white/10 bg-slate-900/90 text-slate-300 hover:text-white text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-lg"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : uploadedImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  ref={imageRef}
                  src={uploadedImage}
                  alt="Daily Group Photo"
                  className="w-full h-full object-contain"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
                />
              </div>
            ) : (
              <div className="p-8 text-center space-y-4 max-w-sm">
                <div className="w-14 h-14 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Upload Group Photos</h3>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                    Select one or more group photos or capture them directly using your camera. The AI will scan faces across all photos and accumulate attendance.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <label className="btn-secondary h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer justify-center flex-1">
                    <Upload className="w-3.5 h-3.5" />
                    Select Image Files
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {/* Native Mobile Camera Gateway (capture="environment") */}
                  <label className="btn-secondary h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer justify-center flex-1 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10">
                    <Camera className="w-3.5 h-3.5" />
                    Capture via Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => setShowCamera(true)}
                    className="btn-secondary h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer justify-center flex-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    Use Web Camera
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnails Row */}
          {uploadedImages.length > 0 && !showCamera && (
            <div className="glass-panel p-3.5 rounded-3xl flex items-center gap-3.5 overflow-x-auto no-scrollbar border border-white/5">
              {uploadedImages.map((img, index) => (
                <div
                  key={index}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${
                    index === activeImageIndex
                      ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/20'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                  onClick={() => setActiveImageIndex(index)}
                >
                  <img src={img.dataUrl} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                  
                  {/* Status Indicator */}
                  <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                    img.analyzed ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} title={img.analyzed ? 'Analyzed' : 'Unanalyzed'} />

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePhoto(index);
                    }}
                    className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-md bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Index Overlay */}
                  <div className="absolute bottom-1.5 left-1.5 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-slate-300">
                    #{index + 1}
                  </div>
                </div>
              ))}

              {/* Add photo card inside row */}
              <label className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/5 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer flex-shrink-0 text-slate-400 hover:text-indigo-400">
                <Plus className="w-5 h-5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Action Trigger Buttons */}
          {uploadedImage && !showCamera && (
            <div className="flex flex-wrap gap-4">
              <button
                onClick={clearAllPhotos}
                className="flex-1 min-w-[120px] h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Clear All Photos
              </button>

              <label className="flex-1 min-w-[120px] h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" /> Add Photo (Camera)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowCamera(true);
                }}
                className="flex-1 min-w-[120px] h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-emerald-400" /> Add Photo (Webcam)
              </button>

              {(!uploadedImages[activeImageIndex]?.analyzed) ? (
                <button
                  onClick={handleAnalyzePhoto}
                  disabled={analyzing || (loadingModels && !forceSimulator)}
                  className="flex-[2] min-w-[200px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all duration-200 cursor-pointer glow-indigo flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" /> Scanning Faces...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4.5 h-4.5" /> Analyze Active Photo
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleConfirmAndSave}
                  disabled={submitting || uploadedImages.some(img => !img.analyzed)}
                  title={uploadedImages.some(img => !img.analyzed) ? "Please analyze all uploaded photos first" : ""}
                  className="flex-[2] min-w-[200px] h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all duration-200 cursor-pointer glow-emerald flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" /> Logging batch...
                    </>
                  ) : (
                    <>
                      <Check className="w-4.5 h-4.5 stroke-[3]" /> Save Attendance Logs
                    </>
                  )}
                </button>
              )}
            </div>
          )}

        </div>

        {/* Right Span: Results Sidebar Panel (Span 4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-5 rounded-3xl space-y-5 h-full flex flex-col min-h-[400px]">
            <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2.5 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Roster Summary
            </h3>

            {!analyzed ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <Info className="w-8 h-8 text-slate-600 mb-2" />
                <h4 className="text-xs font-bold text-slate-400">Awaiting Scan</h4>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-normal">
                  Upload a photo and click "Analyze Group Photo" to populate the biometrics matches.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-5 overflow-hidden">
                {/* Stats Summary Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-xl text-center">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Matched</span>
                    <span className="text-lg font-black text-emerald-400">{matchedStudents.length}</span>
                  </div>

                  <div className="bg-red-500/5 border border-red-500/10 p-2 rounded-xl text-center">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Absent</span>
                    <span className="text-lg font-black text-red-400">{absentStudents.length}</span>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/10 p-2 rounded-xl text-center">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Unmatched</span>
                    <span className="text-lg font-black text-amber-400">{unrecognizedCount}</span>
                  </div>
                </div>

                {/* scrollable listings */}
                <div className="flex-1 space-y-4 overflow-y-auto pr-1 no-scrollbar text-xs">
                  
                  {/* Matched Lists */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest block">Detected & Logged ({matchedStudents.length})</span>
                    <div className="space-y-1.5">
                      {matchedStudents.map((student) => (
                        <div key={student.id} className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-xl">
                          <div>
                            <span className="font-bold text-white block">{student.name}</span>
                            <span className="font-mono text-[9px] text-slate-500">ID: {student.studentCustomId}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold text-emerald-400 block">{student.similarity}% match</span>
                            <span className="text-[9px] font-mono text-slate-400 capitalize">{student.status}</span>
                          </div>
                        </div>
                      ))}
                      {matchedStudents.length === 0 && (
                        <span className="text-slate-600 italic block py-2 pl-2">No students detected.</span>
                      )}
                    </div>
                  </div>

                  {/* Absent Lists */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-red-400 font-extrabold uppercase tracking-widest block">Absent & Fined ({absentStudents.length})</span>
                    <div className="space-y-1.5">
                      {absentStudents.map((student) => (
                        <div key={student.id} className="flex justify-between items-center bg-red-500/5 border border-red-500/10 p-2.5 rounded-xl">
                          <div>
                            <span className="font-bold text-slate-300 block">{student.name}</span>
                            <span className="font-mono text-[9px] text-slate-500">ID: {student.studentCustomId}</span>
                          </div>
                          <span className="text-[9px] font-bold text-red-400 uppercase">ABSENT</span>
                        </div>
                      ))}
                      {absentStudents.length === 0 && (
                        <span className="text-slate-600 italic block py-2 pl-2">No absences logged.</span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function GroupScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center relative bg-[#060814]">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
        <p className="text-slate-400 text-xs font-semibold tracking-widest mt-4 uppercase">Loading Portal...</p>
      </div>
    }>
      <GroupScanContent />
    </Suspense>
  );
}
