/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, 
  Leaf, 
  CloudSun, 
  TrendingUp, 
  ShoppingBag, 
  Camera, 
  Search, 
  ChevronRight, 
  AlertCircle,
  Loader2,
  MapPin,
  Thermometer,
  Droplets,
  Wind,
  Plus,
  MessageSquare,
  ArrowRight,
  User,
  LogOut,
  Settings,
  Save,
  BarChart2,
  PieChart,
  Activity,
  Calendar,
  RotateCw,
  Upload,
  List,
  Package,
  Bell,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, getDocFromServer, addDoc, collection, serverTimestamp, query, where, orderBy, deleteDoc } from 'firebase/firestore';
import { 
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) errorMessage = `Database Error: ${parsed.error}`;
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-cream p-6">
          <div className="bg-white p-8 rounded-3xl border border-olive/10 shadow-xl max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-500 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-serif">Application Error</h2>
            <p className="text-olive/60">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-olive text-white py-3 rounded-xl font-bold hover:bg-olive/90 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type Language = 'en' | 'hi' | 'es' | 'fr' | 'pt' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'as' | 'ur';

const translations = {
  en: {
    appTitle: "AgriAssist",
    dashboard: "Dashboard",
    advisor: "AI Advisor",
    scanner: "Disease Scanner",
    prices: "Market Prices",
    marketplace: "Marketplace",
    chat: "Agri-Chat",
    analytics: "Analytics",
    rotation: "Rotation Planner",
    profile: "My Profile",
    login: "Sign in with Google",
    logout: "Log Out",
    language: "Language",
    languageName: "English"
  },
  hi: {
    appTitle: "एग्रीअसिस्ट",
    dashboard: "डैशबोर्ड",
    advisor: "एआई सलाहकार",
    scanner: "रोग स्कैनर",
    prices: "बाजार मूल्य",
    marketplace: "बाज़ार",
    chat: "एग्री-चैट",
    analytics: "एनालिटिक्स",
    rotation: "फसल चक्र योजनाकार",
    profile: "मेरी प्रोफ़ाइल",
    login: "Google से साइन इन करें",
    logout: "लॉग आउट",
    language: "भाषा",
    languageName: "Hindi"
  },
  bn: {
    appTitle: "এগ্রিঅ্যাসিস্ট",
    dashboard: "ড্যাশবোর্ড",
    advisor: "এআই উপদেষ্টা",
    scanner: "রোগ স্ক্যানার",
    prices: "বাজার দর",
    marketplace: "মার্কেটপ্লেস",
    chat: "এগ্রি-চ্যাট",
    analytics: "বিশ্লেষণ",
    rotation: "ফসল আবর্তন",
    profile: "আমার প্রোফাইল",
    login: "Google দিয়ে সাইন ইন করুন",
    logout: "লগ আউট",
    language: "ভাষা",
    languageName: "Bengali"
  },
  te: {
    appTitle: "అగ్రిఅసిస్ట్",
    dashboard: "డాష్‌బోర్డ్",
    advisor: "ఏఐ సలహాదారు",
    scanner: "వ్యాధి స్కానర్",
    prices: "మార్కెట్ ధరలు",
    marketplace: "మార్కెట్ ప్లేస్",
    chat: "అగ్రి-చాట్",
    analytics: "విశ్లేషణలు",
    rotation: "పంట మార్పిడి",
    profile: "నా ప్రొఫైల్",
    login: "Google తో సైన్ ఇన్ చేయండి",
    logout: "లాగ్ అవుట్",
    language: "భాష",
    languageName: "Telugu"
  },
  mr: {
    appTitle: "अ‍ॅग्रीअसिस्ट",
    dashboard: "डॅशबोर्ड",
    advisor: "एआय सल्लागार",
    scanner: "रोग स्कॅनर",
    prices: "बाजारभाव",
    marketplace: "मार्केटप्लेस",
    chat: "अ‍ॅग्री-चॅट",
    analytics: "विश्लेषण",
    rotation: "पीक रोटेशन",
    profile: "माझी प्रोफाइल",
    login: "Google सह साइन इन करा",
    logout: "लॉग आउट",
    language: "भाषा",
    languageName: "Marathi"
  },
  ta: {
    appTitle: "அக்ரிஅசிஸ்ட்",
    dashboard: "டாஷ்போர்டு",
    advisor: "ஏஐ ஆலோசகர்",
    scanner: "நோய் ஸ்கேனர்",
    prices: "சந்தை விலைகள்",
    marketplace: "சந்தை",
    chat: "அக்ரி-சாட்",
    analytics: "பகுப்பாய்வு",
    rotation: "பயிர் சுழற்சி",
    profile: "என் சுயவிவரம்",
    login: "Google மூலம் உள்நுழைக",
    logout: "வெளியேறு",
    language: "மொழி",
    languageName: "Tamil"
  },
  gu: {
    appTitle: "એગ્રીઆસિસ્ટ",
    dashboard: "ડેશબોર્ડ",
    advisor: "એઆઈ સલાહકાર",
    scanner: "રોગ સ્કેનર",
    prices: "બજાર ભાવ",
    marketplace: "માર્કેટપ્લેસ",
    chat: "એગ્રી-ચેટ",
    analytics: "વિશ્લેષણ",
    rotation: "પાક પરિભ્રમણ",
    profile: "મારી પ્રોફાઇલ",
    login: "Google સાથે સાઇન ઇન કરો",
    logout: "લૉગ આઉટ",
    language: "ભાષા",
    languageName: "Gujarati"
  },
  kn: {
    appTitle: "ಅಗ್ರಿಅಸಿಸ್ಟ್",
    dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    advisor: "ಎಐ ಸಲಹೆಗಾರ",
    scanner: "ರೋಗ ಸ್ಕ್ಯಾನರ್",
    prices: "ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು",
    marketplace: "ಮಾರುಕಟ್ಟೆ",
    chat: "ಅಗ್ರಿ-ಚಾಟ್",
    analytics: "ವಿಶ್ಲೇಷಣೆ",
    rotation: "ಬೆಳೆ ತಿರುಗುವಿಕೆ",
    profile: "ನನ್ನ ಪ್ರೊಫೈಲ್",
    login: "Google ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ",
    logout: "ಲಾಗ್ ಔಟ್",
    language: "ಭಾಷೆ",
    languageName: "Kannada"
  },
  ml: {
    appTitle: "അഗ്രിഅസിസ്റ്റ്",
    dashboard: "ഡാഷ്‌ബോർഡ്",
    advisor: "എഐ ഉപദേശകൻ",
    scanner: "രോഗ സ്കാനർ",
    prices: "വിപണി വിലകൾ",
    marketplace: "മാർക്കറ്റ് പ്ലേസ്",
    chat: "അഗ്രി-ചാറ്റ്",
    analytics: "വിശകലനം",
    rotation: "വിള ഭ്രമണം",
    profile: "എന്റെ പ്രൊഫൈൽ",
    login: "Google ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക",
    logout: "ലോഗ് ഔട്ട്",
    language: "ഭാഷ",
    languageName: "Malayalam"
  },
  pa: {
    appTitle: "ਐਗਰੀਅਸਿਸਟ",
    dashboard: "ਡੈਸ਼ਬੋਰਡ",
    advisor: "ਏਆਈ ਸਲਾਹਕਾਰ",
    scanner: "ਰੋਗ ਸਕੈਨਰ",
    prices: "ਬਾਜ਼ਾਰ ਦੀਆਂ ਕੀਮਤਾਂ",
    marketplace: "ਮਾਰਕੀਟਪਲੇਸ",
    chat: "ਐਗਰੀ-ਚੈਟ",
    analytics: "ਵਿਸ਼ਲੇਸ਼ਣ",
    rotation: "ਫਸਲ ਚੱਕਰ",
    profile: "ਮੇਰੀ ਪ੍ਰੋਫਾਈਲ",
    login: "Google ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ",
    logout: "ਲਾਗ ਆਉਟ",
    language: "ਭਾਸ਼ਾ",
    languageName: "Punjabi"
  },
  or: {
    appTitle: "ଏଗ୍ରିଆସିଷ୍ଟ",
    dashboard: "ଡ୍ୟାସବୋର୍ଡ",
    advisor: "ଏଆଇ ଉପଦେଷ୍ଟା",
    scanner: "ରୋଗ ସ୍କାନର",
    prices: "ବଜାର ଦର",
    marketplace: "ମାର୍କେଟପ୍ଲେସ",
    chat: "ଏଗ୍ରି-ଚାଟ୍",
    analytics: "ବିଶ୍ଳେଷଣ",
    rotation: "ଫସଲ ପର୍ଯ୍ୟାୟ",
    profile: "ମୋ ପ୍ରୋଫାଇଲ୍",
    login: "Google ସହିତ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ",
    logout: "ଲଗ୍ ଆଉଟ୍",
    language: "ଭାଷା",
    languageName: "Odia"
  },
  as: {
    appTitle: "এগ্ৰিএচিষ্ট",
    dashboard: "ডেচবৰ্ড",
    advisor: "এআই উপদেষ্টা",
    scanner: "ৰোগ স্কেনাৰ",
    prices: "বজাৰৰ মূল্য",
    marketplace: "মাৰ্কেটপ্লেচ",
    chat: "এগ্ৰি-চেট",
    analytics: "বিশ্লেষণ",
    rotation: "শস্য আৱৰ্তন",
    profile: "মোৰ প্ৰফাইল",
    login: "Google ৰ সৈতে ছাইন ইন কৰক",
    logout: "লগ আউট",
    language: "ভাষা",
    languageName: "Assamese"
  },
  ur: {
    appTitle: "ایگری اسسٹ",
    dashboard: "ڈیش بورڈ",
    advisor: "اے آئی مشیر",
    scanner: "بیماری سکینر",
    prices: "مارکیٹ کی قیمتیں",
    marketplace: "مارکیٹ پلیس",
    chat: "ایگری چیٹ",
    analytics: "تجزیات",
    rotation: "فصل کی گردش",
    profile: "میری پروفائل",
    login: "گوگل کے ساتھ سائن ان کریں",
    logout: "لاگ آؤٹ",
    language: "زبان",
    languageName: "Urdu"
  },
  es: {
    appTitle: "AgriAssist",
    dashboard: "Panel",
    advisor: "Asesor de IA",
    scanner: "Escáner de Enfermedades",
    prices: "Precios del Mercado",
    marketplace: "Mercado",
    chat: "Agri-Chat",
    analytics: "Analítica",
    rotation: "Planificador de Rotación",
    profile: "Mi Perfil",
    login: "Iniciar sesión con Google",
    logout: "Cerrar sesión",
    language: "Idioma",
    languageName: "Spanish"
  },
  fr: {
    appTitle: "AgriAssist",
    dashboard: "Tableau de bord",
    advisor: "Conseiller IA",
    scanner: "Scanner de Maladies",
    prices: "Prix du Marché",
    marketplace: "Marché",
    chat: "Agri-Chat",
    analytics: "Analytique",
    rotation: "Planificateur de Rotation",
    profile: "Mon Profil",
    login: "Se connecter avec Google",
    logout: "Se déconnecter",
    language: "Langue",
    languageName: "French"
  },
  pt: {
    appTitle: "AgriAssist",
    dashboard: "Painel",
    advisor: "Consultor de IA",
    scanner: "Scanner de Doenças",
    prices: "Preços de Mercado",
    marketplace: "Mercado",
    chat: "Agri-Chat",
    analytics: "Análises",
    rotation: "Planejador de Rotação",
    profile: "Meu Perfil",
    login: "Entrar com Google",
    logout: "Sair",
    language: "Idioma",
    languageName: "Portuguese"
  }
};

const LanguageContext = React.createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
}>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en
});

type Tab = 'dashboard' | 'advisor' | 'scanner' | 'prices' | 'marketplace' | 'chat' | 'profile' | 'analytics' | 'rotation';

interface Weather {
  temp: number;
  humidity: number;
  condition: string;
  location: string;
}

interface Price {
  crop: string;
  price: string;
  trend: 'up' | 'down' | 'stable';
}

interface MarketplaceItem {
  id: string;
  name: string;
  price: string;
  quantity: string;
  farmer: string;
  farmerUid: string;
  location: string;
  image: string;
}

interface Order {
  id: string;
  buyerUid: string;
  itemId: string;
  itemName: string;
  price: string;
  farmerName: string;
  status: string;
  createdAt: any;
}

interface PriceAlert {
  id: string;
  userId: string;
  cropName: string;
  targetPrice: number;
  condition: 'above' | 'below';
  isActive: boolean;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'farmer' | 'buyer';
  farmSize?: string;
  primaryCrops?: string[];
  preferredProduce?: string[];
  location?: string;
  locationHistory?: string[];
}

// --- App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [language, setLanguage] = useState<Language>('en');
  const t = translations[language];
  const [weather, setWeather] = useState<Weather | null>(null);
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const updateWeatherForLocation = async (locationName: string) => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide current typical weather (temp in C, humidity %, condition) for ${locationName}. Return ONLY a JSON object like: {"temp": 25, "humidity": 60, "condition": "Sunny"}`,
        config: { responseMimeType: "application/json" }
      });
      
      const data = JSON.parse(response.text || '{}');
      setWeather({
        temp: data.temp || 25,
        humidity: data.humidity || 60,
        condition: data.condition || 'Clear',
        location: locationName
      });
      setLocationError(null);
    } catch (err) {
      console.error("Error updating weather:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthLoading(false);
      
      if (firebaseUser) {
        // Listen for profile changes
        const profileRef = doc(db, 'users', firebaseUser.uid);
        return onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });
      } else {
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchLocationAndWeather = async () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setCoordinates({ lat: latitude, lng: longitude });
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              const data = await res.json();
              const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || '';
              const state = data.address?.state || '';
              const locationName = [city, state].filter(Boolean).join(', ') || 'Unknown Location';
              
              setWeather({
                temp: 28 + Math.floor(Math.random() * 5), // Mock temp based on real-ish data
                humidity: 60 + Math.floor(Math.random() * 10),
                condition: 'Partly Cloudy',
                location: locationName
              });
            } catch (err) {
              console.error("Error geocoding:", err);
              setWeather({
                temp: 28,
                humidity: 65,
                condition: 'Partly Cloudy',
                location: 'Location Detected (Geocode Failed)'
              });
            }
          },
          (error) => {
            console.error("Geolocation error:", error);
            setLocationError(error.message);
            // Fallback to default
            setWeather({
              temp: 28,
              humidity: 65,
              condition: 'Partly Cloudy',
              location: 'Punjab, India (Default)'
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setLocationError("Geolocation not supported");
        setWeather({
          temp: 28,
          humidity: 65,
          condition: 'Partly Cloudy',
          location: 'Punjab, India (Default)'
        });
      }

      setPrices([
        { crop: 'Wheat', price: '₹2,125/quintal', trend: 'up' },
        { crop: 'Rice (Basmati)', price: '₹4,500/quintal', trend: 'down' },
        { crop: 'Cotton', price: '₹8,500/quintal', trend: 'stable' },
        { crop: 'Sugarcane', price: '₹315/quintal', trend: 'up' },
      ]);
      setLoading(false);
    };

    fetchLocationAndWeather();
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-transparent">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 bg-white/80 backdrop-blur-md border-r border-olive/10 p-6 flex flex-col gap-8 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-olive to-[#3A634D] rounded-xl flex items-center justify-center shadow-lg shadow-olive/20">
              <Sprout className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-olive">{t.appTitle}</h1>
          </div>

          <div className="flex flex-col gap-2">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<TrendingUp className="w-5 h-5" />}
              label={t.dashboard}
            />
            <NavItem 
              active={activeTab === 'advisor'} 
              onClick={() => setActiveTab('advisor')}
              icon={<Leaf className="w-5 h-5" />}
              label={t.advisor}
            />
            <NavItem 
              active={activeTab === 'scanner'} 
              onClick={() => setActiveTab('scanner')}
              icon={<Camera className="w-5 h-5" />}
              label={t.scanner}
            />
            <NavItem 
              active={activeTab === 'prices'} 
              onClick={() => setActiveTab('prices')}
              icon={<Search className="w-5 h-5" />}
              label={t.prices}
            />
            <NavItem 
              active={activeTab === 'marketplace'} 
              onClick={() => setActiveTab('marketplace')}
              icon={<ShoppingBag className="w-5 h-5" />}
              label={t.marketplace}
            />
            <NavItem 
              active={activeTab === 'chat'} 
              onClick={() => setActiveTab('chat')}
              icon={<MessageSquare className="w-5 h-5" />}
              label={t.chat}
            />
            <NavItem 
              active={activeTab === 'analytics'} 
              onClick={() => setActiveTab('analytics')}
              icon={<BarChart2 className="w-5 h-5" />}
              label={t.analytics}
            />
            <NavItem 
              active={activeTab === 'rotation'} 
              onClick={() => setActiveTab('rotation')}
              icon={<RotateCw className="w-5 h-5" />}
              label={t.rotation}
            />
            <NavItem 
              active={activeTab === 'profile'} 
              onClick={() => setActiveTab('profile')}
              icon={<User className="w-5 h-5" />}
              label={t.profile}
            />
          </div>

          <div className="mt-auto space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-olive/40">{t.language}</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full p-2 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none text-sm bg-white"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="ml">മലയാളം (Malayalam)</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                <option value="or">ଓଡ଼ିଆ (Odia)</option>
                <option value="as">অসমীয়া (Assamese)</option>
                <option value="ur">اردو (Urdu)</option>
                <option value="es">Español (Spanish)</option>
                <option value="fr">Français (French)</option>
                <option value="pt">Português (Portuguese)</option>
              </select>
            </div>

            {user ? (
              <div className="p-4 bg-olive/5 rounded-2xl border border-olive/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-olive/10 flex items-center justify-center text-olive font-bold">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
                <div className="flex-1 truncate">
                  <p className="text-sm font-bold text-olive truncate">{user.displayName || 'User'}</p>
                  <p className="text-[10px] text-olive/60 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={() => logOut()}
                  className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                  title={t.logout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => signInWithGoogle()}
                className="w-full bg-olive text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-olive/90 transition-all"
              >
                <User className="w-4 h-4" /> {t.login}
              </button>
            )}

            <div className="p-4 bg-olive/5 rounded-2xl border border-olive/10">
              <p className="text-xs font-medium text-olive/60 uppercase tracking-wider mb-2">Current Location</p>
              <div className="flex items-center justify-between gap-2 text-olive font-medium">
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{weather?.location || 'Detecting...'}</span>
                </div>
                <button 
                  onClick={() => setIsLocationModalOpen(true)}
                  className="p-1 hover:bg-olive/10 rounded-md transition-colors shrink-0"
                  title="Change Location"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {locationError && (
                <p className="text-[10px] text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {locationError}
                </p>
              )}
            </div>
          </div>
        </nav>

        {/* Location Search Modal */}
        <AnimatePresence>
          {isLocationModalOpen && (
            <LocationModal 
              onClose={() => setIsLocationModalOpen(false)} 
              onSelect={(loc) => {
                updateWeatherForLocation(loc);
                setIsLocationModalOpen(false);
              }} 
            />
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-screen relative">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <Dashboard key="dashboard" weather={weather} prices={prices} profile={profile} user={user} />}
            {activeTab === 'advisor' && <AIAdvisor key="advisor" profile={profile} />}
            {activeTab === 'scanner' && <DiseaseScanner key="scanner" />}
            {activeTab === 'prices' && <MarketPrices key="prices" user={user} />}
            {activeTab === 'marketplace' && <Marketplace key="marketplace" user={user} profile={profile} coordinates={coordinates} />}
            {activeTab === 'chat' && <AgriChat key="chat" />}
            {activeTab === 'analytics' && <Analytics key="analytics" profile={profile} />}
            {activeTab === 'rotation' && <CropRotationPlanner key="rotation" profile={profile} />}
            {activeTab === 'profile' && <Profile key="profile" user={user} profile={profile} />}
          </AnimatePresence>
        </main>
      </div>
    </LanguageContext.Provider>
  );
}

// --- Sub-Components ---

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left",
        active 
          ? "bg-olive text-white shadow-lg shadow-olive/20" 
          : "text-olive/60 hover:bg-olive/5 hover:text-olive"
      )}
    >
      <span className={cn("transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")}>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Dashboard({ weather, prices, profile, user }: { weather: Weather | null; prices: Price[]; profile: UserProfile | null; user: FirebaseUser | null }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header>
        <h2 className="text-4xl font-light italic mb-2">
          Welcome back, {profile?.name || user?.displayName?.split(' ')[0] || 'Farmer'}.
        </h2>
        <p className="text-olive/60">
          {profile?.role === 'buyer' 
            ? "Here's the freshest produce available today." 
            : "Here's what's happening in your fields today."}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weather Card */}
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2rem] border border-olive/10 shadow-sm hover:shadow-md transition-all duration-300 col-span-1 md:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-medium flex items-center gap-2">
              <CloudSun className="text-olive" /> Weather Insights
            </h3>
            <span className="text-sm text-olive/40 font-mono uppercase tracking-widest bg-olive/5 px-3 py-1 rounded-full">Live Forecast</span>
          </div>
          
          <div className="flex flex-wrap gap-8 items-center">
            <div className="flex items-center gap-4">
              <div className="text-6xl font-serif text-olive">{weather?.temp}°C</div>
              <div className="text-olive/60 font-medium">
                <p>{weather?.condition}</p>
                <p className="text-sm">Feels like {weather ? weather.temp + 2 : '--'}°C</p>
              </div>
            </div>
            
            <div className="h-12 w-px bg-olive/10 hidden lg:block" />
            
            <div className="flex gap-6">
              <div className="text-center">
                <Droplets className="w-5 h-5 text-olive/40 mx-auto mb-1" />
                <p className="text-xs text-olive/40 uppercase">Humidity</p>
                <p className="font-medium">{weather?.humidity}%</p>
              </div>
              <div className="text-center">
                <Wind className="w-5 h-5 text-olive/40 mx-auto mb-1" />
                <p className="text-xs text-olive/40 uppercase">Wind</p>
                <p className="font-medium">12 km/h</p>
              </div>
              <div className="text-center">
                <Thermometer className="w-5 h-5 text-olive/40 mx-auto mb-1" />
                <p className="text-xs text-olive/40 uppercase">Soil Temp</p>
                <p className="font-medium">24°C</p>
              </div>
            </div>
          </div>
        </div>

        {/* Market Quick Glance */}
        <div className="bg-gradient-to-br from-olive to-[#3A634D] text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <h3 className="text-xl font-medium flex items-center gap-2">
              <TrendingUp className="text-white/80" /> Market Trends
            </h3>
          </div>
          <div className="space-y-4">
            {prices.slice(0, 3).map((p, i) => (
              <div key={i} className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-white/80 font-medium">{p.crop}</span>
                <div className="text-right">
                  <p className="font-serif">{p.price.split('/')[0]}</p>
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider",
                    p.trend === 'up' ? "text-green-400" : p.trend === 'down' ? "text-red-400" : "text-white/40"
                  )}>
                    {p.trend === 'up' ? '▲ Rising' : p.trend === 'down' ? '▼ Falling' : '● Stable'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 text-xs uppercase tracking-widest text-white/60 hover:text-white transition-colors flex items-center justify-center gap-2">
            View All Prices <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction 
          title="Scan Plant" 
          desc="Identify diseases instantly" 
          icon={<Camera className="w-6 h-6" />}
          color="bg-blue-50 text-blue-600"
        />
        <QuickAction 
          title="Crop Advice" 
          desc="What should I plant next?" 
          icon={<Leaf className="w-6 h-6" />}
          color="bg-green-50 text-green-600"
        />
        <QuickAction 
          title="Marketplace" 
          desc="Sell your harvest" 
          icon={<ShoppingBag className="w-6 h-6" />}
          color="bg-orange-50 text-orange-600"
        />
        <QuickAction 
          title="Ask Expert" 
          desc="Chat with Agri-AI" 
          icon={<MessageSquare className="w-6 h-6" />}
          color="bg-purple-50 text-purple-600"
        />
      </div>
    </motion.div>
  );
}

function QuickAction({ title, desc, icon, color }: { title: string; desc: string; icon: React.ReactNode; color: string }) {
  return (
    <button className="bg-white p-5 rounded-2xl border border-olive/10 shadow-sm hover:shadow-md transition-all text-left group">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", color)}>
        {icon}
      </div>
      <h4 className="font-bold text-olive mb-1">{title}</h4>
      <p className="text-xs text-olive/60">{desc}</p>
    </button>
  );
}

function AIAdvisor({ profile }: { profile: UserProfile | null }) {
  const { t } = React.useContext(LanguageContext);
  const [soilType, setSoilType] = useState('Alluvial');
  const [location, setLocation] = useState(profile?.location || 'Punjab');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.location) {
      setLocation(profile.location);
    }
  }, [profile]);

  const getAdvice = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As an expert agricultural advisor, recommend the best crops and fertilizers for a farm in ${location} with ${soilType} soil. Provide specific reasons, planting tips, and expected yield. Format the response in clean markdown. Respond in ${t.languageName} language.`,
      });
      setAdvice(response.text);
    } catch (err) {
      console.error(err);
      setAdvice("Sorry, I couldn't generate advice right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl space-y-8"
    >
      <header>
        <h2 className="text-4xl font-serif mb-2">AI Crop Advisor</h2>
        <p className="text-olive/60 italic">Personalized recommendations for your land.</p>
      </header>

      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2rem] border border-olive/10 shadow-sm hover:shadow-md transition-all duration-300 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Soil Type</label>
            <select 
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
            >
              <option>Alluvial</option>
              <option>Black (Regur)</option>
              <option>Red</option>
              <option>Laterite</option>
              <option>Desert</option>
              <option>Mountain</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Location / Region</label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Punjab, India"
              className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
            />
          </div>
        </div>

        <button 
          onClick={getAdvice}
          disabled={loading}
          className="w-full bg-olive text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-olive/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sprout className="w-5 h-5" />}
          {loading ? 'Generating Advice...' : 'Get Recommendation'}
        </button>
      </div>

      {advice && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm prose prose-olive max-w-none"
        >
          <div className="markdown-body">
            <Markdown>{advice}</Markdown>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function DiseaseScanner() {
  const { t } = React.useContext(LanguageContext);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const scanImage = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const base64Data = image.split(',')[1];
      
      const prompt = `Identify the plant disease in this image. 
Please provide a highly detailed analysis including:
1. **Diagnosis & Confidence**: What is the disease and how confident are you?
2. **Common Symptoms**: What are the visual signs?
3. **Immediate Actions**: What should the farmer do right now to stop the spread?
4. **Detailed Treatment Options**:
   - **Organic/Biological**: Specific organic treatments, recipes, or biological controls.
   - **Chemical**: Specific chemical treatments, active ingredients, and safety precautions.
5. **Long-Term Prevention & IPM**: 
   - **Preventative Strategies**: Long-term strategies to prevent recurrence.
   - **Integrated Pest Management (IPM)**: Best practices for sustainable and holistic pest/disease management.

If the plant is healthy, state that clearly and provide general care tips. 
Format in clean markdown. Respond in ${t.languageName} language.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
          }
        ],
      });
      setResult(response.text);
    } catch (err) {
      console.error(err);
      setResult("Error scanning image. Please ensure it's a clear photo of a plant leaf.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl space-y-8"
    >
      <header>
        <h2 className="text-4xl font-serif mb-2">Disease Scanner</h2>
        <p className="text-olive/60 italic">Instant diagnosis using AI Vision.</p>
      </header>

      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2rem] border border-olive/10 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center gap-6">
        <div 
          className={cn(
            "w-full aspect-video rounded-2xl border-2 border-dashed border-olive/20 flex flex-col items-center justify-center overflow-hidden relative",
            image ? "border-none" : "bg-white"
          )}
        >
          {image ? (
            <img src={image} alt="Upload" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="w-16 h-16 bg-olive/5 rounded-full flex items-center justify-center mb-2">
                <Camera className="w-8 h-8 text-olive/40" />
              </div>
              <div>
                <p className="text-olive font-medium text-lg">Upload or capture a leaf photo</p>
                <p className="text-xs text-olive/60 mt-1">Ensure the leaf is well-lit and in focus</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-olive text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-olive/90 transition-colors"
                >
                  <Camera className="w-4 h-4" /> Take Photo
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-olive/10 text-olive px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-olive/20 transition-colors"
                >
                  <Upload className="w-4 h-4" /> Upload File
                </button>
              </div>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden" 
            accept="image/*"
          />
          <input 
            type="file" 
            ref={cameraInputRef}
            onChange={handleImageUpload}
            className="hidden" 
            accept="image/*"
            capture="environment"
          />
        </div>

        {image && (
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => setImage(null)}
              className="flex-1 border border-olive/10 py-4 rounded-2xl font-bold text-olive hover:bg-olive/5 transition-colors"
            >
              Reset
            </button>
            <button 
              onClick={scanImage}
              disabled={loading}
              className="flex-[2] bg-olive text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-olive/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {loading ? 'Analyzing Plant...' : 'Start Diagnosis'}
            </button>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm prose prose-olive max-w-none"
        >
          <div className="markdown-body">
            <Markdown>{result}</Markdown>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function MarketPrices({ user }: { user: FirebaseUser | null }) {
  const { t } = React.useContext(LanguageContext);
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }
    const q = query(collection(db, 'alerts'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAlerts: PriceAlert[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedAlerts.push({
          id: doc.id,
          userId: data.userId,
          cropName: data.cropName,
          targetPrice: data.targetPrice,
          condition: data.condition,
          isActive: data.isActive,
          createdAt: data.createdAt
        });
      });
      setAlerts(fetchedAlerts);
    }, (error) => {
      console.error("Error fetching alerts:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Simulation of real-time price alerts
  useEffect(() => {
    if (alerts.length === 0) return;
    
    const interval = setInterval(() => {
      const activeAlerts = alerts.filter(a => a.isActive);
      if (activeAlerts.length > 0) {
        const randomAlert = activeAlerts[Math.floor(Math.random() * activeAlerts.length)];
        // 10% chance to trigger an alert every 10 seconds for demonstration
        if (Math.random() < 0.1) {
          alert(`🔔 REAL-TIME ALERT: ${randomAlert.cropName} price has gone ${randomAlert.condition} ₹${randomAlert.targetPrice}!`);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [alerts]);

  const searchPrices = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find current market prices for ${queryText || 'major agricultural crops'} in India. Include wholesale prices, trends, and major market (mandi) rates. Format the data in a clear table or list. Respond in ${t.languageName} language.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      setResults(response.text);
    } catch (err) {
      console.error(err);
      setResults("Could not fetch market data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl space-y-8"
    >
      <header>
        <h2 className="text-4xl font-serif mb-2">Market Price Finder</h2>
        <p className="text-olive/60 italic">Real-time data from mandis across the country.</p>
      </header>

      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2rem] border border-olive/10 shadow-sm hover:shadow-md transition-all duration-300 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-serif flex items-center gap-2">
            <Bell className="w-6 h-6 text-olive" /> Price Alerts
          </h3>
          {user && (
            <button 
              onClick={() => setIsAlertModalOpen(true)}
              className="bg-olive/10 text-olive px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-olive/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Alert
            </button>
          )}
        </div>
        
        {user ? (
          alerts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {alerts.map(alert => (
                <div key={alert.id} className="bg-olive/5 p-4 rounded-2xl border border-olive/10 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-olive">{alert.cropName}</h4>
                    <p className="text-sm text-olive/60">
                      Alert when <strong className="text-olive">{alert.condition}</strong> ₹{alert.targetPrice}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn("w-2 h-2 rounded-full", alert.isActive ? "bg-green-500" : "bg-gray-300")}></span>
                    <button 
                      onClick={() => deleteDoc(doc(db, 'alerts', alert.id))}
                      className="text-red-500/60 hover:text-red-500 transition-colors p-2"
                      title="Delete Alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-olive/60 text-sm">You haven't set any price alerts yet.</p>
          )
        ) : (
          <p className="text-olive/60 text-sm">Sign in to set price alerts.</p>
        )}
      </div>

      <div className="bg-white p-4 rounded-3xl border border-olive/10 shadow-sm flex gap-4">
        <input 
          type="text" 
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search crop (e.g. Mustard, Potato, Onion)..."
          className="flex-1 p-4 bg-transparent outline-none font-medium"
        />
        <button 
          onClick={searchPrices}
          disabled={loading}
          className="bg-olive text-white px-8 rounded-2xl font-bold flex items-center gap-2 hover:bg-olive/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          Search
        </button>
      </div>

      {results && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm prose prose-olive max-w-none"
        >
          <div className="markdown-body">
            <Markdown>{results}</Markdown>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isAlertModalOpen && (
          <AlertModal 
            onClose={() => setIsAlertModalOpen(false)} 
            user={user}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AlertModal({ onClose, user }: { onClose: () => void; user: FirebaseUser | null }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cropName: '',
    targetPrice: '',
    condition: 'below'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const price = Number(formData.targetPrice);
    if (isNaN(price) || price <= 0) {
      alert("Please enter a valid target price.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'alerts'), {
        userId: user.uid,
        cropName: formData.cropName,
        targetPrice: price,
        condition: formData.condition,
        isActive: true,
        createdAt: serverTimestamp()
      });
      alert('Price alert set successfully!');
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'alerts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-olive/10 flex justify-between items-center">
          <h3 className="text-xl font-serif flex items-center gap-2">
            <Bell className="w-5 h-5 text-olive" /> Set Price Alert
          </h3>
          <button onClick={onClose} className="text-olive/40 hover:text-olive">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <form id="alert-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Crop Name</label>
              <input 
                required
                type="text" 
                value={formData.cropName}
                onChange={(e) => setFormData({...formData, cropName: e.target.value})}
                placeholder="e.g. Wheat, Tomato"
                className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({...formData, condition: e.target.value})}
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none bg-white"
                >
                  <option value="below">Drops Below</option>
                  <option value="above">Rises Above</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Target Price (₹)</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={formData.targetPrice}
                  onChange={(e) => setFormData({...formData, targetPrice: e.target.value})}
                  placeholder="e.g. 2500"
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-olive/10 bg-olive/5">
          <button 
            type="submit"
            form="alert-form"
            disabled={loading}
            className="w-full bg-olive text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-olive/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
            {loading ? 'Setting Alert...' : 'Save Alert'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Marketplace({ user, profile, coordinates }: { user: FirebaseUser | null; profile: UserProfile | null; coordinates: {lat: number, lng: number} | null }) {
  const [activeMarketTab, setActiveMarketTab] = useState<'produce' | 'markets' | 'farms'>('produce');
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'produce'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: MarketplaceItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedItems.push({
          id: doc.id,
          name: data.name,
          price: data.price,
          quantity: data.quantity,
          farmer: data.farmerName,
          farmerUid: data.farmerUid,
          location: data.location,
          image: data.image
        });
      });
      setItems(fetchedItems);
    }, (error) => {
      console.error("Error fetching produce:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    const q = query(collection(db, 'orders'), where('buyerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedOrders.push({
          id: doc.id,
          buyerUid: data.buyerUid,
          itemId: data.itemId,
          itemName: data.itemName,
          price: data.price,
          farmerName: data.farmerName,
          status: data.status,
          createdAt: data.createdAt
        });
      });
      // Sort client-side if needed or add composite index
      fetchedOrders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setOrders(fetchedOrders);
    }, (error) => {
      console.error("Error fetching orders:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (activeMarketTab === 'produce') return;
    
    const fetchNearbyPlaces = async () => {
      setLoadingPlaces(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const queryStr = activeMarketTab === 'markets' 
          ? "Find nearby agricultural markets, farmer's markets, or mandis."
          : "Find nearby farms, agricultural lands, or orchards.";
          
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: queryStr,
          config: {
            tools: [{ googleMaps: {} }],
            toolConfig: coordinates ? {
              retrievalConfig: {
                latLng: {
                  latitude: coordinates.lat,
                  longitude: coordinates.lng
                }
              }
            } : undefined
          }
        });
        
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const places = chunks?.map(chunk => chunk.maps).filter(Boolean) || [];
        setNearbyPlaces(places);
      } catch (err) {
        console.error("Error fetching nearby places:", err);
      } finally {
        setLoadingPlaces(false);
      }
    };

    fetchNearbyPlaces();
  }, [activeMarketTab, coordinates]);

  const handleBuyNow = async (item: MarketplaceItem) => {
    if (!user) {
      alert("Please sign in to make a purchase.");
      return;
    }
    if (user.uid === item.farmerUid) {
      alert("You cannot buy your own produce.");
      return;
    }
    
    setBuyingId(item.id);
    try {
      await addDoc(collection(db, 'orders'), {
        buyerUid: user.uid,
        itemId: item.id,
        itemName: item.name,
        price: item.price,
        farmerName: item.farmer,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert(`Successfully placed order for ${item.name}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-serif mb-2">Farmer's Marketplace</h2>
          <p className="text-olive/60 italic">Direct from farm to buyer.</p>
        </div>
        <div className="flex gap-3">
          {user && (
            <button 
              onClick={() => setIsOrdersModalOpen(true)}
              className="bg-white text-olive border border-olive/10 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-olive/5 transition-all shadow-sm"
            >
              <Package className="w-5 h-5" /> My Orders
            </button>
          )}
          {profile?.role === 'farmer' && (
            <button 
              onClick={() => setIsListingModalOpen(true)}
              className="bg-olive text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-olive/90 transition-all shadow-lg shadow-olive/20"
            >
              <Plus className="w-5 h-5" /> List Produce
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveMarketTab('produce')}
          className={cn(
            "px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap",
            activeMarketTab === 'produce' 
              ? "bg-olive text-white shadow-md shadow-olive/20" 
              : "bg-white text-olive/60 hover:bg-olive/5"
          )}
        >
          Produce Listings
        </button>
        <button
          onClick={() => setActiveMarketTab('markets')}
          className={cn(
            "px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap",
            activeMarketTab === 'markets' 
              ? "bg-olive text-white shadow-md shadow-olive/20" 
              : "bg-white text-olive/60 hover:bg-olive/5"
          )}
        >
          Nearby Markets
        </button>
        <button
          onClick={() => setActiveMarketTab('farms')}
          className={cn(
            "px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap",
            activeMarketTab === 'farms' 
              ? "bg-olive text-white shadow-md shadow-olive/20" 
              : "bg-white text-olive/60 hover:bg-olive/5"
          )}
        >
          Nearby Farms
        </button>
      </div>

      {activeMarketTab === 'produce' && (
        items.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-olive/10 text-center">
            <ShoppingBag className="w-12 h-12 text-olive/20 mx-auto mb-4" />
            <h3 className="text-xl font-serif mb-2">No Produce Listed Yet</h3>
            <p className="text-olive/60">Be the first to list your farm fresh produce!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <motion.div 
                key={item.id}
                whileHover={{ y: -5 }}
                className="bg-white rounded-3xl border border-olive/10 overflow-hidden shadow-sm group flex flex-col"
              >
              <div className="aspect-[4/3] overflow-hidden relative">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-olive">
                  {item.price}
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h4 className="text-xl font-serif mb-1">{item.name}</h4>
                <div className="flex items-center gap-2 text-xs text-olive/60 mb-2">
                  <MapPin className="w-3 h-3" />
                  <span>{item.location}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-olive/60 mb-4">
                  <List className="w-3 h-3" />
                  <span>Qty: {item.quantity}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-olive/5 mb-4">
                  <div className="text-[10px] uppercase tracking-wider text-olive/40 font-bold">
                    Farmer: <span className="text-olive">{item.farmer}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleBuyNow(item)}
                  disabled={buyingId === item.id || user?.uid === item.farmerUid}
                  className="mt-auto w-full bg-olive text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-olive/90 transition-colors disabled:opacity-50"
                >
                  {buyingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                  {buyingId === item.id ? 'Processing...' : user?.uid === item.farmerUid ? 'Your Listing' : 'Buy Now'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
        )
      )}

      {activeMarketTab !== 'produce' && (
        <div className="space-y-6">
          {loadingPlaces ? (
            <div className="bg-white p-12 rounded-3xl border border-olive/10 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-olive animate-spin mb-4" />
              <p className="text-olive/60 font-medium">Finding nearby {activeMarketTab}...</p>
            </div>
          ) : nearbyPlaces.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-olive/10 text-center">
              <MapPin className="w-12 h-12 text-olive/20 mx-auto mb-4" />
              <h3 className="text-xl font-serif mb-2">No {activeMarketTab} found nearby</h3>
              <p className="text-olive/60">Try updating your location or check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nearbyPlaces.map((place, index) => (
                <div key={index} className="bg-white p-6 rounded-3xl border border-olive/10 shadow-sm hover:shadow-md transition-all">
                  <h4 className="text-xl font-serif mb-2">{place.title || 'Unknown Place'}</h4>
                  {place.uri && (
                    <a 
                      href={place.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-olive hover:underline text-sm font-medium flex items-center gap-1 mt-4"
                    >
                      View on Google Maps <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isListingModalOpen && (
          <ListingModal 
            onClose={() => setIsListingModalOpen(false)} 
            user={user}
            profile={profile}
          />
        )}
        {isOrdersModalOpen && (
          <OrdersModal 
            onClose={() => setIsOrdersModalOpen(false)} 
            orders={orders}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ListingModal({ onClose, user, profile }: { onClose: () => void; user: FirebaseUser | null; profile: UserProfile | null }) {
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    quantity: '',
    location: profile?.location || ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1000000) {
        alert("Image size must be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!image) {
      alert("Please upload an image of the produce.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'produce'), {
        farmerUid: user.uid,
        farmerName: profile.name || user.displayName || 'Unknown Farmer',
        name: formData.name,
        price: formData.price,
        quantity: formData.quantity,
        location: formData.location,
        image: image,
        createdAt: serverTimestamp()
      });
      alert('Produce listed successfully!');
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'produce');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-olive/10 flex justify-between items-center">
          <h3 className="text-xl font-serif">List Your Produce</h3>
          <button onClick={onClose} className="text-olive/40 hover:text-olive">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <form id="listing-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Produce Name</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Organic Wheat, Fresh Tomatoes"
                className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Price</label>
                <input 
                  required
                  type="text" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="e.g. ₹2,500/q"
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Quantity</label>
                <input 
                  required
                  type="text" 
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  placeholder="e.g. 50 Quintals"
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Location</label>
              <input 
                required
                type="text" 
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="e.g. Ludhiana, Punjab"
                className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Produce Image</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full h-40 rounded-xl border-2 border-dashed border-olive/20 flex flex-col items-center justify-center cursor-pointer hover:bg-olive/5 transition-all overflow-hidden relative",
                  image ? "border-none" : ""
                )}
              >
                {image ? (
                  <img src={image} alt="Upload" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-olive/20 mb-2" />
                    <p className="text-olive/40 font-medium text-sm">Click to upload photo</p>
                    <p className="text-[10px] uppercase tracking-widest text-olive/20 mt-1">JPG, PNG up to 1MB</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden" 
                  accept="image/*"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-olive/10 bg-olive/5">
          <button 
            type="submit"
            form="listing-form"
            disabled={loading}
            className="w-full bg-olive text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-olive/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            {loading ? 'Listing Produce...' : 'List Produce'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function OrdersModal({ onClose, orders }: { onClose: () => void; orders: Order[] }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-olive/10 flex justify-between items-center">
          <h3 className="text-xl font-serif flex items-center gap-2">
            <Package className="w-5 h-5 text-olive" /> My Orders
          </h3>
          <button onClick={onClose} className="text-olive/40 hover:text-olive">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-olive/20 mx-auto mb-4" />
              <p className="text-olive/60 font-medium">You haven't placed any orders yet.</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-4 rounded-2xl border border-olive/10 bg-olive/5 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <h4 className="font-bold text-olive text-lg">{order.itemName}</h4>
                  <p className="text-sm text-olive/60">Farmer: {order.farmerName}</p>
                  <p className="text-xs text-olive/40 mt-1">
                    Ordered on: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </p>
                </div>
                <div className="flex flex-col items-start sm:items-end justify-between">
                  <span className="font-serif text-lg">{order.price}</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                    order.status === 'completed' ? "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AgriChat() {
  const { t } = React.useContext(LanguageContext);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 0) {
        return [{ role: 'ai', text: `Hello! I am your Agri-AI assistant. How can I help you with your farming today? I will respond in ${t.languageName}.` }];
      }
      const newMessages = [...prev];
      newMessages[0] = { role: 'ai', text: `Hello! I am your Agri-AI assistant. How can I help you with your farming today? I will respond in ${t.languageName}.` };
      return newMessages;
    });
  }, [t.languageName]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are a helpful agricultural assistant. You help farmers with crop advice, weather patterns, fertilizer use, and market trends. Keep your answers practical and supportive. You MUST respond in ${t.languageName} language.`,
        },
      });

      const response = await chat.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'ai', text: response.text }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'ai', text: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl h-[calc(100vh-80px)] flex flex-col"
    >
      <header className="mb-6">
        <h2 className="text-4xl font-serif mb-2">Agri-Chat</h2>
        <p className="text-olive/60 italic">Multilingual support for all your farming queries.</p>
      </header>

      <div className="flex-1 bg-white rounded-3xl border border-olive/10 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn(
              "flex w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}>
              <div className={cn(
                "max-w-[80%] p-4 rounded-2xl",
                msg.role === 'user' 
                  ? "bg-olive text-white rounded-tr-none" 
                  : "bg-olive/5 text-olive rounded-tl-none border border-olive/10"
              )}>
                <div className="markdown-body text-sm">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-olive/5 p-4 rounded-2xl rounded-tl-none border border-olive/10">
                <Loader2 className="w-4 h-4 animate-spin text-olive" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 bg-olive/5 border-t border-olive/10 flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask anything (e.g. How to grow organic tomatoes?)..."
            className="flex-1 p-4 bg-white rounded-xl border border-olive/10 outline-none focus:ring-2 focus:ring-olive/20"
          />
          <button 
            onClick={sendMessage}
            disabled={loading}
            className="bg-olive text-white p-4 rounded-xl hover:bg-olive/90 transition-colors disabled:opacity-50"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function LocationModal({ onClose, onSelect }: { onClose: () => void; onSelect: (loc: string) => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ name: string; uri: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find the location: ${search}. Provide a list of matching places with their names.`,
        config: {
          tools: [{ googleMaps: {} }]
        }
      });
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const places = chunks
          .filter(c => c.maps)
          .map(c => ({
            name: c.maps?.title || 'Unknown Place',
            uri: c.maps?.uri || ''
          }));
        setResults(places);
      } else {
        // Fallback if no grounding chunks
        setResults([{ name: search, uri: '' }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-olive/10 flex justify-between items-center">
          <h3 className="text-xl font-serif">Select Location</h3>
          <button onClick={onClose} className="text-olive/40 hover:text-olive">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search city, village, or region..."
              className="flex-1 p-3 rounded-xl border border-olive/10 outline-none focus:ring-2 focus:ring-olive/20"
              autoFocus
            />
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="bg-olive text-white px-4 rounded-xl hover:bg-olive/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {results.map((res, i) => (
              <button
                key={i}
                onClick={() => onSelect(res.name)}
                className="w-full p-4 text-left rounded-xl hover:bg-olive/5 border border-transparent hover:border-olive/10 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-olive/40" />
                  <span className="font-medium text-olive">{res.name}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-olive/20 group-hover:text-olive transition-colors" />
              </button>
            ))}
            {results.length === 0 && !loading && (
              <p className="text-center text-olive/40 py-8 text-sm italic">Search for a location to see results</p>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div className="px-6 pb-6">
            <p className="text-[10px] text-olive/40 uppercase tracking-widest text-center">
              Powered by Google Maps Grounding
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Profile({ user, profile }: { user: FirebaseUser | null; profile: UserProfile | null }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    role: 'farmer',
    farmSize: '',
    location: '',
    primaryCrops: [],
    preferredProduce: [],
  });

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.displayName || '',
        email: user.email || '',
      }));
    }
  }, [profile, user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const profileData = {
        ...formData,
        uid: user.uid,
        email: user.email || '',
      } as UserProfile;
      
      await setDoc(doc(db, 'users', user.uid), profileData);
      alert('Profile saved successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6"
      >
        <div className="w-20 h-20 bg-olive/5 rounded-full flex items-center justify-center">
          <User className="w-10 h-10 text-olive/40" />
        </div>
        <div>
          <h2 className="text-3xl font-serif mb-2">Sign in to manage your profile</h2>
          <p className="text-olive/60">Save your farm details and preferences to get personalized advice.</p>
        </div>
        <button 
          onClick={() => signInWithGoogle()}
          className="bg-olive text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-olive/90 transition-all shadow-lg shadow-olive/20"
        >
          <User className="w-5 h-5" /> Sign In with Google
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif mb-2">Your Profile</h2>
          <p className="text-olive/60 italic">Manage your agricultural identity.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-olive text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-olive/90 transition-all shadow-lg shadow-olive/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm space-y-6">
            <h3 className="text-xl font-medium flex items-center gap-2">
              <Settings className="text-olive w-5 h-5" /> Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Role</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'farmer' | 'buyer' }))}
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                >
                  <option value="farmer">Farmer</option>
                  <option value="buyer">Buyer / Trader</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Primary Location</label>
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Ludhiana, Punjab"
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm space-y-6">
            <h3 className="text-xl font-medium flex items-center gap-2">
              {formData.role === 'farmer' ? <Sprout className="text-olive w-5 h-5" /> : <ShoppingBag className="text-olive w-5 h-5" />}
              {formData.role === 'farmer' ? 'Farm Details' : 'Buying Preferences'}
            </h3>

            {formData.role === 'farmer' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Farm Size (Acres)</label>
                  <input 
                    type="text" 
                    value={formData.farmSize}
                    onChange={(e) => setFormData(prev => ({ ...prev, farmSize: e.target.value }))}
                    placeholder="e.g. 10"
                    className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Primary Crops (Comma separated)</label>
                  <input 
                    type="text" 
                    value={formData.primaryCrops?.join(', ')}
                    onChange={(e) => setFormData(prev => ({ ...prev, primaryCrops: e.target.value.split(',').map(s => s.trim()) }))}
                    placeholder="e.g. Wheat, Rice, Cotton"
                    className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Preferred Produce (Comma separated)</label>
                <input 
                  type="text" 
                  value={formData.preferredProduce?.join(', ')}
                  onChange={(e) => setFormData(prev => ({ ...prev, preferredProduce: e.target.value.split(',').map(s => s.trim()) }))}
                  placeholder="e.g. Organic Wheat, Basmati Rice"
                  className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-olive text-white p-8 rounded-3xl shadow-xl">
            <h3 className="text-xl font-medium mb-4">Why fill this?</h3>
            <ul className="space-y-4 text-sm text-white/80">
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">1</div>
                <p>Get personalized crop advice based on your soil and location.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">2</div>
                <p>Connect with buyers looking for your specific produce.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">3</div>
                <p>Track market prices relevant to your crops.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Analytics({ profile }: { profile: UserProfile | null }) {
  const yieldData = [
    { year: '2021', wheat: 4000, rice: 2400, cotton: 2400 },
    { year: '2022', wheat: 3000, rice: 1398, cotton: 2210 },
    { year: '2023', wheat: 2000, rice: 9800, cotton: 2290 },
    { year: '2024', wheat: 2780, rice: 3908, cotton: 2000 },
    { year: '2025', wheat: 1890, rice: 4800, cotton: 2181 },
    { year: '2026', wheat: 2390, rice: 3800, cotton: 2500 },
  ];

  const soilHealthData = [
    { month: 'Jan', nitrogen: 45, phosphorus: 30, potassium: 25 },
    { month: 'Feb', nitrogen: 52, phosphorus: 32, potassium: 28 },
    { month: 'Mar', nitrogen: 48, phosphorus: 29, potassium: 30 },
    { month: 'Apr', nitrogen: 61, phosphorus: 35, potassium: 35 },
    { month: 'May', nitrogen: 55, phosphorus: 33, potassium: 32 },
    { month: 'Jun', nitrogen: 40, phosphorus: 28, potassium: 24 },
  ];

  const profitabilityData = [
    { name: 'Wheat', value: 45 },
    { name: 'Rice', value: 30 },
    { name: 'Cotton', value: 15 },
    { name: 'Mustard', value: 10 },
  ];

  const COLORS = ['#5A5A40', '#8B8B6B', '#A8A88F', '#C5C5B3'];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-6xl space-y-8"
    >
      <header>
        <h2 className="text-4xl font-serif mb-2">Farm Analytics</h2>
        <p className="text-olive/60 italic">Visualizing your farm's performance over time.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Yield Trends */}
        <div className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-medium flex items-center gap-2">
              <TrendingUp className="text-olive w-5 h-5" /> Yield Trends (kg/acre)
            </h3>
            <div className="text-xs text-olive/40 font-mono uppercase tracking-widest">Yearly Performance</div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yieldData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F0" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#5A5A40', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5A5A40', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#F5F5F0', borderRadius: '12px', border: '1px solid #5A5A4020' }}
                  itemStyle={{ color: '#5A5A40' }}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="wheat" stroke="#5A5A40" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="rice" stroke="#8B8B6B" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="cotton" stroke="#A8A88F" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Crop Profitability */}
        <div className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-medium flex items-center gap-2">
              <PieChart className="text-olive w-5 h-5" /> Crop Profitability (%)
            </h3>
            <div className="text-xs text-olive/40 font-mono uppercase tracking-widest">Current Season</div>
          </div>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={profitabilityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {profitabilityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#F5F5F0', borderRadius: '12px', border: '1px solid #5A5A4020' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Soil Health */}
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2rem] border border-olive/10 shadow-sm hover:shadow-md transition-all duration-300 space-y-6 lg:col-span-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-medium flex items-center gap-2">
              <Activity className="text-olive w-5 h-5" /> Soil Nutrient Levels (mg/kg)
            </h3>
            <div className="text-xs text-olive/40 font-mono uppercase tracking-widest">Last 6 Months</div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={soilHealthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5A5A40', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5A5A40', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#F5F5F0' }}
                  contentStyle={{ backgroundColor: '#F5F5F0', borderRadius: '12px', border: '1px solid #5A5A4020' }}
                />
                <Legend iconType="rect" />
                <Bar dataKey="nitrogen" fill="#5A5A40" radius={[4, 4, 0, 0]} />
                <Bar dataKey="phosphorus" fill="#8B8B6B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="potassium" fill="#A8A88F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Analytics Insights */}
      <div className="bg-olive/5 p-8 rounded-3xl border border-olive/10 space-y-4">
        <h3 className="text-xl font-serif text-olive">AI Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-olive/10 hover:shadow-md transition-all duration-300">
            <p className="text-xs font-bold uppercase tracking-wider text-olive/40 mb-2">Yield Forecast</p>
            <p className="text-sm text-olive">Your wheat yield is projected to increase by 12% this season due to favorable weather patterns.</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-olive/10 hover:shadow-md transition-all duration-300">
            <p className="text-xs font-bold uppercase tracking-wider text-olive/40 mb-2">Soil Recommendation</p>
            <p className="text-sm text-olive">Nitrogen levels are peaking. Consider reducing urea application for the next 2 weeks to prevent leaching.</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-olive/10 hover:shadow-md transition-all duration-300">
            <p className="text-xs font-bold uppercase tracking-wider text-olive/40 mb-2">Profit Optimization</p>
            <p className="text-sm text-olive">Rice profitability is currently highest. Diversifying 10% more land to Basmati could increase net revenue.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CropRotationPlanner({ profile }: { profile: UserProfile | null }) {
  const { t } = React.useContext(LanguageContext);
  const [currentCrop, setCurrentCrop] = useState('');
  const [soilType, setSoilType] = useState(profile?.farmSize ? 'Alluvial' : 'Alluvial'); // Defaulting
  const [location, setLocation] = useState(profile?.location || '');
  const [seasons, setSeasons] = useState('4');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.location) setLocation(profile.location);
    if (profile?.primaryCrops && profile.primaryCrops.length > 0) {
      setCurrentCrop(profile.primaryCrops[0]);
    }
  }, [profile]);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `As an expert agronomist, create a ${seasons}-season crop rotation plan for a field in ${location} with ${soilType} soil. 
      The current crop is ${currentCrop}. 
      Consider soil health (nutrient replenishment, pest cycle disruption) and market demand. 
      For each season, provide:
      1. Recommended Crop
      2. Why it's chosen (soil/market reasons)
      3. Key management tips.
      Format the response in clean markdown with a summary table at the end. Respond in ${t.languageName} language.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setPlan(response.text);
    } catch (err) {
      console.error(err);
      setPlan("Failed to generate rotation plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl space-y-8"
    >
      <header>
        <h2 className="text-4xl font-serif mb-2">Crop Rotation Planner</h2>
        <p className="text-olive/60 italic">Optimize your soil health and profits with AI-driven sequencing.</p>
      </header>

      <div className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Current Crop</label>
            <input 
              type="text" 
              value={currentCrop}
              onChange={(e) => setCurrentCrop(e.target.value)}
              placeholder="e.g. Wheat"
              className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Soil Type</label>
            <select 
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
            >
              <option>Alluvial</option>
              <option>Black (Regur)</option>
              <option>Red</option>
              <option>Laterite</option>
              <option>Desert</option>
              <option>Mountain</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Location</label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Punjab, India"
              className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-olive/40">Planning Horizon (Seasons)</label>
            <select 
              value={seasons}
              onChange={(e) => setSeasons(e.target.value)}
              className="w-full p-3 rounded-xl border border-olive/10 focus:ring-2 focus:ring-olive/20 outline-none"
            >
              <option value="2">2 Seasons (1 Year)</option>
              <option value="4">4 Seasons (2 Years)</option>
              <option value="6">6 Seasons (3 Years)</option>
              <option value="8">8 Seasons (4 Years)</option>
            </select>
          </div>
        </div>

        <button 
          onClick={generatePlan}
          disabled={loading || !currentCrop || !location}
          className="w-full bg-olive text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-olive/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCw className="w-5 h-5" />}
          {loading ? 'Generating Plan...' : 'Generate Rotation Plan'}
        </button>
      </div>

      {plan && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-olive/10 shadow-sm prose prose-olive max-w-none"
        >
          <div className="markdown-body">
            <Markdown>{plan}</Markdown>
          </div>
        </motion.div>
      )}

      {/* Educational Section */}
      {!plan && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <RotationBenefit 
            title="Nutrient Balance" 
            desc="Different crops use different nutrients, preventing soil depletion." 
            icon={<Droplets className="w-5 h-5" />}
          />
          <RotationBenefit 
            title="Pest Control" 
            desc="Breaking crop cycles disrupts the life cycles of pests and diseases." 
            icon={<AlertCircle className="w-5 h-5" />}
          />
          <RotationBenefit 
            title="Market Resilience" 
            desc="Diversifying crops protects against price drops in a single commodity." 
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>
      )}
    </motion.div>
  );
}

function RotationBenefit({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="bg-olive/5 p-6 rounded-2xl border border-olive/10">
      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-olive mb-4 shadow-sm">
        {icon}
      </div>
      <h4 className="font-bold text-olive mb-2">{title}</h4>
      <p className="text-xs text-olive/60 leading-relaxed">{desc}</p>
    </div>
  );
}
