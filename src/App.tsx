import React, { useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  state = { hasError: false, error: null };
  props: { children: ReactNode };

  constructor(props: { children: ReactNode }) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4 text-center">
          <div className="card max-w-md p-8 space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold">Oups ! Quelque chose s'est mal passé.</h2>
            <p className="text-[#8E8E93]">Une erreur inattendue est survenue. Veuillez rafraîchir la page ou contacter le support.</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full"
            >
              Rafraîchir la page
            </button>
            {this.state.error && (
              <pre className="mt-4 p-4 bg-gray-100 rounded text-xs text-left overflow-auto max-h-40">
                {(this.state.error as Error).message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import { GoogleGenAI, Type } from "@google/genai";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  FileSearch, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ArrowRight,
  ShieldCheck,
  Search,
  LogIn,
  PlusCircle,
  Files,
  Send,
  Clock,
  PieChart,
  BookOpen,
  Bell,
  ChevronRight,
  Download,
  Eye,
  MoreVertical,
  AlertTriangle,
  Check,
  Info,
  XCircle,
  Mail,
  Users,
  Building2,
  CreditCard,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  updateDoc
} from 'firebase/firestore';

interface AnalysisAlert {
  severity: 'Critique' | 'Majeur' | 'Mineur';
  message: string;
  reference?: string;
}

interface AnalyzedDocument {
  name: string;
  type: string;
}

interface AnalysisResult {
  id?: string;
  userId: string;
  fileName: string;
  documentType: string;
  isTypeCorrect: boolean;
  amountFigures: number;
  amountFiguresDeclared?: number;
  amountWords: string;
  areAmountsConsistent: boolean;
  isClientConsistent: boolean;
  transferType: string;
  detectedDocuments?: string[];
  missingDocuments?: string[];
  isCompliant: boolean;
  complianceDetails: string;
  kycToleranceApplied?: boolean;
  kycToleranceMessage?: string;
  status: 'Compliant' | 'Incoherent' | 'Non-Compliant';
  score: number;
  alerts: AnalysisAlert[];
  analyzedDocuments: AnalyzedDocument[];
  penaltyRisk?: string;
  createdAt?: Timestamp;
}

interface VeilleNewsItem {
  title: string;
  desc: string;
  date: string;
  fullText: string;
  sources: string[];
}

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'user' | 'admin' | 'super_admin' | 'audit' | 'control';
  bankId?: string;
  bankName?: string;
  country?: string;
  isActive: boolean;
  createdAt: Timestamp;
}

interface Dossier {
  id?: string;
  userId: string;
  reference: string;
  clientName: string;
  country: string;
  transferType: string;
  amount: number;
  currency: string;
  status: 'Draft' | 'Pending' | 'Compliant' | 'Incoherent' | 'Non-Compliant' | 'Transmitted' | 'Rejected' | 'Analyse IA' | 'OnHold' | 'PendingOPI';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  analysisId?: string;
  score?: number;
  files?: string[];
  analyzedDocuments?: AnalyzedDocument[];
  opiValidationStatus?: 'Pending' | 'Approved' | 'Rejected';
  opiValidationComment?: string;
  opiValidatedBy?: string;
  opiValidatedAt?: Timestamp;
  physicalDocStatus?: 'Pending' | 'Received';
  physicalDocReceivedAt?: Timestamp;
  physicalDocReceivedBy?: string;
  isDuplicate?: boolean;
}

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
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

import verificationRules from './skills/verification_rules.json';

const validateDocumentWithAI = async (file: File, expectedType: string): Promise<{ isValid: boolean, message: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const base64 = await fileToBase64(file);
    const base64Data = base64.split(',')[1];

    let extraInstructions = "";
    if (expectedType === "Lettre de mise en demeure") {
      extraInstructions = "Pour ce document spécifique, vérifie impérativement la présence du cachet du client ET du cachet de la banque. Si l'un des deux manque, le document est invalide.";
    }

    // Map expectedType to the keys in verification_rules.json
    const getRuleKey = (type: string): string => {
      const t = type.toLowerCase();
      if (t.includes("ordre de virement")) return "ordre_de_virement";
      if (t.includes("engagement")) return "fiche_engagement";
      if (t.includes("domiciliation")) return "domiciliation";
      if (t.includes("facture") || t.includes("note d'honoraires")) return "facture";
      if (t.includes("déclaration") && t.includes("douane")) return "declaration_douaniere";
      if (t.includes("quittance") && t.includes("douane")) return "quittance_douane";
      if (t.includes("mise en demeure")) return "lettre_de_mise_en_demeure";
      if (t.includes("contrat") || t.includes("convention")) return "contrat_convention";
      if (t.includes("kyc") || t.includes("rccm") || t.includes("statuts")) return "kyc_legal";
      if (t.includes("identité") || t.includes("passeport") || t.includes("carte de séjour")) return "identite";
      if (t.includes("salaire") || t.includes("bulletin")) return "salaire";
      if (t.includes("impôt") || t.includes("arn") || t.includes("quittance")) return "fiscalite";
      if (t.includes("transport") || t.includes("connaissement") || t.includes("lta") || t.includes("lettre de voiture")) return "titre_transport";
      if (t.includes("nif") || t.includes("identification fiscale")) return "nif";
      return "document_checks"; // Default
    };

    const ruleKey = getRuleKey(expectedType);
    const specificChecks = ruleKey && (verificationRules.document_checks as any)[ruleKey] 
      ? (verificationRules.document_checks as any)[ruleKey].checks 
      : [];
    const checksText = specificChecks.length > 0 ? `\nVoici les points de contrôle spécifiques pour ce type de document :\n- ${specificChecks.join('\n- ')}` : "";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: `Nous sommes aujourd'hui le ${new Date().toLocaleDateString('fr-FR')}.
            Analyse ce document. Est-ce qu'il s'agit bien d'un(e) "${expectedType}" ? ${extraInstructions}${checksText}
            Réponds au format JSON avec les champs suivants:
            - isValid: boolean
            - identifiedType: string (le type de document que tu as identifié)
            - confidence: number (0-1)
            - reason: string (explication courte en français détaillant les points de contrôle qui ont échoué ou réussi)` },
            { inlineData: { data: base64Data, mimeType: file.type } }
          ]
        }
      ],
      config: {
        systemInstruction: "Tu es un expert en conformité bancaire pour la zone CEMAC. Ton rôle est de vérifier rigoureusement les documents de transfert de fonds pour s'assurer qu'ils respectent les réglementations de change (LC/BEAC/2021). Sois extrêmement précis sur les dates, les montants, les cachets et les signatures.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            identifiedType: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ["isValid", "identifiedType", "confidence", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return {
      isValid: result.isValid && result.confidence > 0.7,
      message: result.isValid ? "Document valide et conforme" : `Document non conforme. Identifié comme: ${result.identifiedType}. ${result.reason}`
    };
  } catch (error) {
    console.error("AI Validation Error:", error);
    return { isValid: false, message: "Erreur lors de l'analyse IA. Veuillez réessayer." };
  }
};

const classifyDocumentWithAI = async (file: File, possibleTypes: string[]): Promise<{ identifiedType: string | null, confidence: number, reason: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const base64 = await fileToBase64(file);
    const base64Data = base64.split(',')[1];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: `Nous sommes aujourd'hui le ${new Date().toLocaleDateString('fr-FR')}.
            Analyse ce document et identifie à quel type il appartient parmi la liste suivante :
            ${possibleTypes.join('\n- ')}
            
            Réponds au format JSON avec les champs suivants:
            - identifiedType: string (le type exact de la liste ci-dessus, ou null si aucun ne correspond)
            - confidence: number (0-1)
            - reason: string (explication courte en français)` },
            { inlineData: { data: base64Data, mimeType: file.type } }
          ]
        }
      ],
      config: {
        systemInstruction: "Tu es un expert en conformité bancaire pour la zone CEMAC. Ton rôle est de classifier les documents de transfert de fonds.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            identifiedType: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ["identifiedType", "confidence", "reason"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Classification Error:", error);
    return { identifiedType: null, confidence: 0, reason: "Erreur lors de l'analyse." };
  }
};

const ANALYSIS_CHECKS = [
  "Vérification de la complétude documentaire par type de transfert",
  "Analyse de la validité des dates (Règlementation CEMAC)",
  "Contrôle de cohérence montants / devises / bénéficiaires",
  "Validation des références Douane / Domiciliation (B/S)",
  "Reconnaissance et validation des messages SWIFT MT298",
  "Vérification croisée N° facture ↔ Ordre de Virement",
  "Analyse de l'authenticité des scans (Détection CamScanner)",
  "Évaluation du risque de pénalité de 5% (Règlementation de change)"
];

const CHECKLISTS: Record<string, string[]> = {
  "Achat de biens": [
    "Ordre de virement (daté < 15 jours)",
    "Fiche d'engagement de change (signée et cachetée)",
    "Attestation de domiciliation (si montant > 5 millions FCFA)",
    "Facture définitive ou pro forma (< 12 mois)",
    "Déclaration d'importation (Douane / SGS)",
    "Quittance de douane (si applicable)",
    "Titre de transport (Connaissement B/L, LTA ou Lettre de voiture)",
    "Attestation de Non-Redevance (ARN) valide",
    "Lettre d'engagement d'apurement (délai 3 mois)",
    "Lettre de mise en demeure (si apurement partiel)",
    "Autorisation pour produits soumis à restriction (le cas échéant)",
    "Registre du Commerce et du Crédit Mobilier (RCCM)",
    "Attestation d'Identification Fiscale (NIF)",
    "Statuts de la société",
    "Plan de localisation certifié",
    "Pièce d'identité des dirigeants et signataires"
  ],
  "Achat de services": [
    "Ordre de virement (daté < 15 jours)",
    "Fiche d'engagement de change (signée et cachetée)",
    "Attestation de domiciliation (si montant > 5 millions FCFA)",
    "Facture de service ou note d'honoraires (< 12 mois)",
    "Contrat de service dûment enregistré (Impôts)",
    "Déclaration et domiciliation d'importation de service (Instruction 007)",
    "Preuve de l'effectivité du service (PV de réception, rapport)",
    "Attestation de Non-Redevance (ARN) valide",
    "Lettre d'engagement d'apurement (délai 1 mois)",
    "Lettre de mise en demeure (si apurement partiel)",
    "Preuve de règlement de l'impôt (Retenue à la source)",
    "Registre du Commerce et du Crédit Mobilier (RCCM)",
    "Attestation d'Identification Fiscale (NIF)",
    "Statuts de la société",
    "Plan de localisation certifié",
    "Pièce d'identité des dirigeants et signataires"
  ],
  "Assistance technique": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Convention d'assistance technique enregistrée",
    "Facture détaillée des prestations",
    "Relevé de compte spécial assistance technique",
    "Bilan et compte de résultat (Période de référence)",
    "Relevé de nature de frais (Détails et facturation)",
    "Preuve de règlement de l'impôt lié ou exonération"
  ],
  "Revenus du travail - Salaires": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Contrat de travail et/ou autorisation de travail valide",
    "Bulletin de salaire (en lien avec le montant)",
    "Justificatif de paiement du salaire (avis de crédit)",
    "Attestation de présence au poste",
    "Passeport avec visa en cours de validité",
    "Carte de séjour (pour résidents étrangers)",
    "Preuve de paiement de l'impôt lié au travail",
    "RIB du bénéficiaire à l'étranger"
  ],
  "Revenus du travail - Honoraires": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Contrat de service ou bon de commande enregistré",
    "Facture d'honoraires (< 12 mois)",
    "Preuve de l'encaissement des honoraires",
    "RIB du bénéficiaire à l'étranger"
  ],
  "Revenus du travail - Per diems & indemnités": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Tout document liant le non-résident à l'entité",
    "Preuve de l'encaissement",
    "RIB du bénéficiaire à l'étranger"
  ],
  "Aide familiale - Études / Scolarité": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Lettre du donneur d'ordre (motif et relation)",
    "Pièce d'identité ou titre de séjour du bénéficiaire",
    "Déclaration de l'origine des fonds",
    "Copie de la carte d'élève ou d'étudiant",
    "Attestation d'inscription",
    "Facture d'inscription"
  ],
  "Aide familiale - Subsistance": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Lettre du donneur d'ordre (motif et relation)",
    "Pièce d'identité ou titre de séjour du bénéficiaire",
    "Déclaration de l'origine des fonds",
    "Preuve de non-résidence du bénéficiaire dans la zone",
    "État des charges de subsistance"
  ],
  "Aide familiale - Maladie": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Lettre du donneur d'ordre (motif et relation)",
    "Pièce d'identité ou titre de séjour du bénéficiaire",
    "Avis médical ou autorisation d'évacuation sanitaire",
    "Attestation de séjour hospitalier",
    "Déclaration de l'origine des fonds"
  ],
  "Règlement de loyers": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Contrat de bail",
    "Titre de propriété du bénéficiaire",
    "Facture pro forma (le cas échéant)"
  ],
  "Remboursement d'emprunt": [
    "Ordre de virement (daté < 15 jours)",
    "Attestation de Non-Redevance (ARN)",
    "Lettre de prise d'acte de la BEAC (déclaration préalable)",
    "Contrat de prêt",
    "Échéancier de remboursement ou tableau d'amortissement",
    "Preuve de rapatriement de l'emprunt ou effectivité des acquisitions"
  ]
};

const REGULATORY_REFERENCES = {
  PENALTY_RATE: "5%",
  CIRCULAR_LETTER: "Lettre Circulaire LC/BEAC/2021",
  DECREE: "Arrêté Ministériel n°084/MINEFI",
  WARNING_MESSAGE: "Attention : Le non-respect de la soumission de ces documents expose la banque à une pénalité de 5% du montant du transfert selon la réglementation de change en vigueur."
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'admin' | 'super_admin' | 'audit' | 'control'>('user');
  const [loginCountry, setLoginCountry] = useState('');
  const [showDuplicatePopup, setShowDuplicatePopup] = useState<{ show: boolean, dossierId?: string }>({ show: false });
  const [files, setFiles] = useState<Record<string, File>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFileAnalyzing, setCurrentFileAnalyzing] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [veilleNews, setVeilleNews] = useState<VeilleNewsItem[]>([]);
  const [isCheckingVeille, setIsCheckingVeille] = useState(false);
  const [lastVeilleCheck, setLastVeilleCheck] = useState<string | null>(null);
  const [veilleSearchQuery, setVeilleSearchQuery] = useState("");
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allBanks, setAllBanks] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new_dossier' | 'dossiers' | 'transmissions' | 'appurement' | 'reporting' | 'veille' | 'admin_dashboard' | 'admin_users' | 'admin_banks' | 'admin_billing' | 'admin_settings'>('dashboard');
  const [showAppurementModal, setShowAppurementModal] = useState<string | null>(null);
  const [showMiseEnDemeure, setShowMiseEnDemeure] = useState(false);
  const [appurementDocs, setAppurementDocs] = useState<Record<string, boolean>>({});
  const [appurementFilter, setAppurementFilter] = useState('Tous');
  const [appurementSearch, setAppurementSearch] = useState('');
  const [dossierStatusFilter, setDossierStatusFilter] = useState('Tous les statuts');

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [newDossierStep, setNewDossierStep] = useState(1);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProcessingResults, setBulkProcessingResults] = useState<{ fileName: string, status: 'processing' | 'success' | 'error', message: string }[]>([]);
  const [newDossierData, setNewDossierData] = useState({
    clientName: '',
    country: '',
    transferType: '',
    amount: '',
    currency: 'XAF',
  });
  const [opiComment, setOpiComment] = useState("");

  const handleBulkFiles = async (selectedFiles: File[]) => {
    setIsBulkProcessing(true);
    const initialResults: { fileName: string, status: 'processing' | 'success' | 'error', message: string }[] = selectedFiles.map(f => ({
      fileName: f.name,
      status: 'processing',
      message: 'Analyse en cours...'
    }));
    setBulkProcessingResults(initialResults);

    const possibleTypes = CHECKLISTS[newDossierData.transferType as keyof typeof CHECKLISTS] || [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        const classification = await classifyDocumentWithAI(file, possibleTypes);
        
        if (classification.identifiedType && classification.confidence > 0.7) {
          // Check if this type is already filled
          if (files[classification.identifiedType]) {
            initialResults[i] = {
              fileName: file.name,
              status: 'error',
              message: `Doublon ignoré : ${classification.identifiedType} déjà présent.`
            };
          } else {
            // Validate the document content now that we know the type
            const validation = await validateDocumentWithAI(file, classification.identifiedType);
            
            if (validation.isValid) {
              setFiles(prev => ({
                ...prev,
                [classification.identifiedType!]: file
              }));
              initialResults[i] = {
                fileName: file.name,
                status: 'success',
                message: `Identifié comme : ${classification.identifiedType}`
              };
            } else {
              initialResults[i] = {
                fileName: file.name,
                status: 'error',
                message: `Identifié comme ${classification.identifiedType} mais non conforme : ${validation.message}`
              };
            }
          }
        } else {
          initialResults[i] = {
            fileName: file.name,
            status: 'error',
            message: "Type de document non identifié avec certitude."
          };
        }
      } catch (error) {
        initialResults[i] = {
          fileName: file.name,
          status: 'error',
          message: "Erreur lors du traitement."
        };
      }
      setBulkProcessingResults([...initialResults]);
    }
    setIsBulkProcessing(false);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Create or update user profile
        const userRef = doc(db, 'users', u.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            const newUser: UserProfile = {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              role: u.email === 'gess.srh.td@gmail.com' ? 'super_admin' : 'user',
              isActive: true,
              createdAt: Timestamp.now()
            };
            await setDoc(userRef, newUser);
            setUserProfile(newUser);
            setUserRole(newUser.role);
          } else {
            const profile = userDoc.data() as UserProfile;
            
            // Check if user is active
            if (profile.isActive === false) {
              await logout();
              setToast({ message: "Votre compte a été désactivé. Veuillez contacter l'administrateur.", type: 'error' });
              return;
            }

            // Check country restriction if loginCountry is set
            if (loginCountry && profile.country && profile.country !== loginCountry) {
              await logout();
              setToast({ message: `Accès refusé. Votre compte est rattaché au pays : ${profile.country}.`, type: 'error' });
              return;
            }

            setUserProfile(profile);
            setUserRole(profile.role);
          }
        } catch (error) {
          console.error("Error creating user profile:", error);
        }
      } else {
        setUserProfile(null);
        setUserRole('user');
      }
    });
    return () => unsubscribe();
  }, [loginCountry]);

  useEffect(() => {
    if (!user) return;

    const qAnalyses = query(
      collection(db, 'analyses'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeAnalyses = onSnapshot(qAnalyses, (snapshot) => {
      const analyses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AnalysisResult[];
      setHistory(analyses);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'analyses');
    });

    const qDossiers = query(
      collection(db, 'dossiers'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeDossiers = onSnapshot(qDossiers, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Dossier[];
      setDossiers(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'dossiers');
    });

    return () => {
      unsubscribeAnalyses();
      unsubscribeDossiers();
    };
  }, [user]);

  useEffect(() => {
    if (userRole !== 'super_admin' && userRole !== 'admin') return;

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qBanks = query(collection(db, 'banks'), orderBy('name', 'asc'));
    const unsubscribeBanks = onSnapshot(qBanks, (snapshot) => {
      setAllBanks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeBanks();
    };
  }, [userRole]);

  useEffect(() => {
    if (userRole === 'super_admin' && allBanks.length === 0) {
      const initialBanks = [
        { name: 'BGFIBank', country: 'Gabon', status: 'Active', userCount: 12 },
        { name: 'Afriland First Bank', country: 'Cameroun', status: 'Active', userCount: 8 },
        { name: 'Société Générale', country: 'Cameroun', status: 'Active', userCount: 15 },
        { name: 'EcoBank', country: 'Togo', status: 'Active', userCount: 24 },
        { name: 'Commercial Bank of Chad', country: 'Tchad', status: 'Active', userCount: 5 },
      ];
      initialBanks.forEach(async (bank) => {
        try {
          await addDoc(collection(db, 'banks'), bank);
        } catch (error) {
          console.error("Error adding initial bank:", error);
        }
      });
    }
  }, [userRole, allBanks.length]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card max-w-md w-full p-8 text-center space-y-6"
        >
          <div className="w-16 h-16 bg-[#007AFF] rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-200">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">CEMAC Regional AI</h1>
            <p className="text-[#8E8E93] mt-2">Connectez-vous pour accéder à la plateforme d'analyse réglementaire.</p>
          </div>
          
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-[#1D1D1F]">Sélectionnez votre pays de connexion</label>
            <select 
              value={loginCountry}
              onChange={(e) => setLoginCountry(e.target.value)}
              className="w-full p-3 bg-[#F5F5F7] border-none rounded-xl text-sm appearance-none"
            >
              <option value="">Tous les pays (Défaut)</option>
              <option value="Cameroun">Cameroun</option>
              <option value="Centrafrique">Centrafrique</option>
              <option value="Congo">Congo</option>
              <option value="Gabon">Gabon</option>
              <option value="Guinée Équatoriale">Guinée Équatoriale</option>
              <option value="Tchad">Tchad</option>
            </select>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full py-3 bg-white border border-[#E5E5E7] rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-[#F5F5F7] transition-all shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Continuer avec Google
          </button>
        </motion.div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      setFiles(prev => {
        const next: Record<string, File> = { ...prev };
        newFiles.forEach((f: File) => {
          next[f.name] = f;
        });
        return next;
      });
      setResult(null);
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  };

  const startActualAnalysis = async () => {
    const filesArray = Object.values(files) as File[];
    if (filesArray.length === 0 || !user) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setCurrentFileAnalyzing("Préparation des documents pour l'analyse GESS_IA...");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Convert files to base64 for Gemini
      const fileParts = await Promise.all(filesArray.map(async (file, index) => {
        setCurrentFileAnalyzing(`Lecture de : ${file.name}...`);
        setAnalysisProgress((index / filesArray.length) * 20);
        const base64 = await fileToBase64(file);
        return {
          inlineData: {
            data: base64.split(',')[1],
            mimeType: file.type || 'application/pdf' // Default to PDF if type is missing
          }
        };
      }));

      setCurrentFileAnalyzing("Analyse des documents par le moteur GESS_IA...");
      setAnalysisProgress(30);

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              amountWords: { type: Type.STRING, description: "Le montant en lettres détecté dans les documents" },
              amountFiguresExtracted: { type: Type.NUMBER, description: "Le montant en chiffres extrait des documents (Facture/Ordre de virement)" },
              areAmountsConsistent: { type: Type.BOOLEAN, description: "Si le montant en chiffres et en lettres sont cohérents entre eux et avec le formulaire" },
              isClientConsistent: { type: Type.BOOLEAN, description: "Si le nom du client est cohérent sur tous les documents fournis" },
              status: { type: Type.STRING, description: "Compliant, Incoherent, or Non-Compliant" },
              analyzedDocuments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Nom du fichier original" },
                    type: { type: Type.STRING, description: "Type de document identifié par le contenu réel (ex: RCCM, Facture, Ordre de Virement, CNI, etc.)" }
                  },
                  required: ["name", "type"]
                }
              },
              alerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING, description: "Critique, Majeur, or Mineur" },
                    message: { type: Type.STRING },
                    reference: { type: Type.STRING }
                  }
                }
              },
              missingDocuments: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              complianceDetails: { type: Type.STRING },
              kycToleranceApplied: { type: Type.BOOLEAN, description: "Si la tolérance KYC a été appliquée (absence de pièce d'identité compensée par KYC/RCCM)" },
              kycToleranceMessage: { type: Type.STRING, description: "Explication sur l'importance de la pièce manquante même si tolérée" }
            },
            required: ["score", "status", "alerts", "missingDocuments", "complianceDetails", "amountWords", "areAmountsConsistent", "isClientConsistent", "amountFiguresExtracted", "analyzedDocuments"]
          }
        },
        contents: [
          {
            text: `Analyses ce dossier de transfert CEMAC pour conformité en examinant les documents fournis.
            
            INSTRUCTION CRITIQUE D'IDENTIFICATION:
            Tu es un agent de banque expert. NE TE FIE PAS aux noms des fichiers (ex: "AUTRE.pdf", "doc1.jpg"). Tu dois LIRE et DÉCHIFFRER le contenu visuel et textuel de chaque document pour identifier sa nature réelle. 
            - Si un document est nommé "AUTRE" mais contient des mentions de "Registre du Commerce et du Crédit Mobilier" ou "RCCM", identifie-le comme "RCCM".
            - Si un document contient une facture, identifie-le comme "Facture".
            - Analyse chaque page pour trouver des preuves de ce que c'est réellement.
            
            DONNÉES SAISIES DANS LE FORMULAIRE (À COMPARER AVEC LES DOCUMENTS):
            - Client: ${newDossierData.clientName}
            - Pays de destination: ${newDossierData.country}
            - Type de transfert: ${newDossierData.transferType}
            - Montant déclaré: ${newDossierData.amount} ${newDossierData.currency}
            
            Règlementation de référence: 
            1. Lettre Circulaire LC/BEAC/2021 (Modalités de transfert et pièces justificatives)
            2. Arrêté Ministériel n°084/MINEFI (Règlementation des changes)
            
            TU DOIS IMPÉRATIVEMENT VÉRIFIER ET SIGNALER TOUTE DIFFÉRENCE:
            1. COHÉRENCE DU MONTANT: Extrais le montant exact de la Facture et de l'Ordre de Virement. Compare-le au montant saisi dans le formulaire (${newDossierData.amount}). Si le montant sur la facture (ex: 152 400) est différent du montant saisi (ex: 151 000), signale-le comme une anomalie CRITIQUE "Incohérence de montant entre le formulaire et les pièces justificatives".
            2. COHÉRENCE DU CLIENT: Vérifie si le nom du client (${newDossierData.clientName}) est identique sur TOUS les documents.
            3. COMPLÉTUDE & TOLÉRANCE KYC: 
               - Vérifie si toutes les pièces requises pour un "${newDossierData.transferType}" sont présentes (en te basant sur ton identification réelle des docs).
               - RÈGLE DE TOLÉRANCE KYC: Si la pièce d'identité du bénéficiaire ou du fournisseur est manquante, MAIS que le document KYC et le RCCM sont présents (et contiennent les informations d'identité, photo et infos RCCM), alors TOLÈRE l'absence de la pièce d'identité. 
               - Dans ce cas de tolérance, mets "kycToleranceApplied" à true et explique dans "kycToleranceMessage" que bien que les informations soient présentes dans le KYC/RCCM, il est fortement recommandé d'avoir la pièce d'identité séparée pour une conformité parfaite. Le statut peut être "Compliant" si c'est la seule alerte.
            4. RISQUES: Calcule le risque de pénalité de 5% si des documents manquent ou si les montants sont incohérents.
            
            Génère un rapport de conformité structuré en français.`
          },
          ...fileParts
        ]
      });

      const data = JSON.parse(response.text);
      
      setAnalysisProgress(100);
      setCurrentFileAnalyzing(null);

      const finalResult: AnalysisResult = {
        userId: user.uid,
        fileName: filesArray[0].name,
        documentType: newDossierData.transferType,
        isTypeCorrect: true,
        amountFigures: data.amountFiguresExtracted || parseFloat(newDossierData.amount.replace(/\s/g, '')) || 0,
        amountFiguresDeclared: parseFloat(newDossierData.amount.replace(/\s/g, '')) || 0,
        amountWords: data.amountWords || "", 
        areAmountsConsistent: data.areAmountsConsistent,
        isClientConsistent: data.isClientConsistent,
        transferType: newDossierData.transferType,
        isCompliant: data.status === 'Compliant',
        complianceDetails: data.complianceDetails,
        status: data.status as any,
        score: data.score,
        alerts: data.alerts,
        kycToleranceApplied: data.kycToleranceApplied,
        kycToleranceMessage: data.kycToleranceMessage,
        analyzedDocuments: data.analyzedDocuments || filesArray.map(f => ({ name: f.name, type: 'Document' })),
        missingDocuments: data.missingDocuments,
        penaltyRisk: data.status !== 'Compliant' ? `Risque de pénalité de 5% (env. ${(parseFloat(newDossierData.amount.replace(/\s/g, '')) * 0.05).toLocaleString()} ${newDossierData.currency}) pour non-conformité.` : undefined,
        createdAt: serverTimestamp() as any
      };

      let analysisId: string | undefined;
      try {
        const docRef = await addDoc(collection(db, 'analyses'), finalResult);
        analysisId = docRef.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'analyses');
      }

      setResult({ ...finalResult, id: analysisId });
      setIsAnalyzing(false);
      setNewDossierStep(4);
      setToast({ message: "Analyse terminée avec succès !", type: 'success' });
    } catch (error) {
      setIsAnalyzing(false);
      setCurrentFileAnalyzing(null);
      console.error("Analysis Error:", error);
      setToast({ message: "Erreur lors de l'analyse IA. Veuillez réessayer.", type: 'error' });
    }
  };

  const handleAnalyze = async () => {
    const filesArray = Object.values(files) as File[];
    if (filesArray.length === 0 || !user) return;

    // Check for duplicates in the current user's dossiers or all dossiers if admin
    const isDuplicate = dossiers.some(d => 
      d.clientName === newDossierData.clientName && 
      d.amount === parseFloat(newDossierData.amount.replace(/\s/g, '')) && 
      d.country === newDossierData.country
    );

    if (isDuplicate) {
      setShowDuplicatePopup({ show: true });
      return;
    }

    startActualAnalysis();
  };

  const handleTransmitToOPI = async (dossierId?: string) => {
    try {
      const targetDossierId = dossierId || selectedDossier?.id;
      if (!targetDossierId) return;

      const dossierRef = doc(db, 'dossiers', targetDossierId);
      await updateDoc(dossierRef, {
        status: 'PendingOPI',
        opiValidationStatus: 'Pending',
        updatedAt: serverTimestamp()
      });

      setToast({ message: "Dossier transmis au responsable OPI pour validation.", type: 'success' });
      setIsDetailModalOpen(false);
      // Refresh dossiers list
      const updatedDossiers = dossiers.map(d => 
        d.id === targetDossierId ? { ...d, status: 'PendingOPI' as const, opiValidationStatus: 'Pending' as const } : d
      );
      setDossiers(updatedDossiers);
    } catch (error) {
      console.error("Error transmitting to OPI:", error);
      setToast({ message: "Erreur lors de la transmission.", type: 'error' });
    }
  };

  const handleOPIValidation = async (dossierId: string, status: 'Approved' | 'Rejected', comment: string) => {
    try {
      const dossierRef = doc(db, 'dossiers', dossierId);
      const updateData: any = {
        status: status === 'Approved' ? 'Compliant' : 'Rejected',
        opiValidationStatus: status,
        opiValidationComment: comment,
        opiValidatedBy: user?.email,
        opiValidatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (status === 'Approved') {
        updateData.physicalDocStatus = 'Pending';
      }

      await updateDoc(dossierRef, updateData);

      setToast({ 
        message: status === 'Approved' 
          ? "Dossier validé. Veuillez maintenant transmettre les documents physiques." 
          : `Dossier rejeté. Motif : ${comment}`, 
        type: status === 'Approved' ? 'success' : 'info' 
      });
      
      // Refresh dossiers list
      const updatedDossiers = dossiers.map(d => 
        d.id === dossierId ? { 
          ...d, 
          status: (status === 'Approved' ? 'Compliant' : 'Rejected') as any, 
          opiValidationStatus: status,
          opiValidationComment: comment,
          physicalDocStatus: status === 'Approved' ? 'Pending' : undefined
        } : d
      );
      setDossiers(updatedDossiers);
    } catch (error) {
      console.error("Error in OPI validation:", error);
      setToast({ message: "Erreur lors de la validation OPI.", type: 'error' });
    }
  };

  const handleConfirmPhysicalReceipt = async (dossierId: string) => {
    try {
      const dossierRef = doc(db, 'dossiers', dossierId);
      await updateDoc(dossierRef, {
        physicalDocStatus: 'Received',
        physicalDocReceivedAt: serverTimestamp(),
        physicalDocReceivedBy: user?.email,
        updatedAt: serverTimestamp()
      });

      setToast({ message: "Réception des documents physiques confirmée.", type: 'success' });
      
      const updatedDossiers = dossiers.map(d => 
        d.id === dossierId ? { 
          ...d, 
          physicalDocStatus: 'Received' as const
        } : d
      );
      setDossiers(updatedDossiers);
    } catch (error) {
      console.error("Error confirming physical receipt:", error);
      setToast({ message: "Erreur lors de la confirmation de réception.", type: 'error' });
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;
    
    const report = `
RAPPORT D'ANALYSE DE CONFORMITÉ CEMAC
--------------------------------------
Document: ${result.fileName || 'Document'}
Type: ${result.documentType}
Type de transfert: ${result.transferType}
Date: ${new Date().toLocaleString()}
Statut: ${result.status}

RÉSULTATS:
- Cohérence des montants: ${result.areAmountsConsistent ? 'OUI' : 'NON'}
- Type de document correct: ${result.isTypeCorrect ? 'OUI' : 'NON'}
- Montant en chiffres: ${result.amountFigures.toLocaleString()} FCFA
- Montant en lettres: ${result.amountWords}
- Conformité Arrêté 084: ${result.isCompliant ? 'OUI' : 'NON'}
- Détails: ${result.complianceDetails}
    `;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapport_Analyse_${result.fileName || 'CEMAC'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchVeilleUpdates = async () => {
    setIsCheckingVeille(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Quelles sont les dernières mises à jour réglementaires de la BEAC et de la COBAC concernant les transferts de fonds et la réglementation des changes en zone CEMAC pour l'année 2025 and 2026 ? Cite les textes officiels si possible.",
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = chunks?.map((c: any) => c.web?.uri).filter(Boolean) || [];

      const updates = [
        {
          title: "Mise à jour temps réel GESS_IA",
          desc: text.substring(0, 200) + "...",
          fullText: text,
          date: new Date().toLocaleDateString(),
          sources: sources
        }
      ];

      setVeilleNews(updates);
      setLastVeilleCheck(new Date().toLocaleString());
      setToast({ message: "Veille réglementaire actualisée avec succès !", type: 'success' });
    } catch (error) {
      console.error("Veille Error:", error);
      setToast({ message: "Erreur lors de l'actualisation de la veille.", type: 'error' });
    } finally {
      setIsCheckingVeille(false);
    }
  };

  const handleCreateDossier = async (overrideStatus?: string) => {
    if (!user) return;
    
    const reference = `OV-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const dossier: Dossier = {
      userId: user.uid,
      reference,
      clientName: newDossierData.clientName,
      country: newDossierData.country,
      transferType: newDossierData.transferType,
      amount: parseFloat(newDossierData.amount.replace(/\s/g, '')) || 0,
      currency: newDossierData.currency,
      status: (overrideStatus as any) || (result ? (result.status as any) : 'Draft'),
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      analysisId: result?.id,
      score: result?.score,
      files: (Object.values(files) as File[]).map(f => f.name),
      analyzedDocuments: result?.analyzedDocuments
    };

    try {
      await addDoc(collection(db, 'dossiers'), dossier);
      setToast({ message: 'Dossier créé avec succès !', type: 'success' });
      setActiveTab('dossiers');
      setNewDossierStep(1);
      setNewDossierData({
        clientName: '',
        country: '',
        transferType: '',
        amount: '',
        currency: 'XAF',
      });
      setResult(null);
      setFiles([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'dossiers');
    }
  };

  const handlePutOnHold = async (dossierId: string) => {
    try {
      const dossierRef = doc(db, 'dossiers', dossierId);
      await updateDoc(dossierRef, { 
        status: 'OnHold',
        updatedAt: serverTimestamp()
      });
      setToast({ message: 'Dossier mis en attente.', type: 'info' });
      setIsDetailModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'dossiers');
    }
  };

  const handleReject = async (dossierId: string) => {
    try {
      const dossierRef = doc(db, 'dossiers', dossierId);
      await updateDoc(dossierRef, { 
        status: 'Rejected',
        updatedAt: serverTimestamp()
      });
      setToast({ message: 'Dossier rejeté.', type: 'error' });
      setIsDetailModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'dossiers');
    }
  };

  const handleViewDossier = (dossier: Dossier) => {
    setSelectedDossier(dossier);
    setIsDetailModalOpen(true);
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Compliant': return 'status-compliant';
      case 'Incoherent': return 'status-incoherent';
      case 'Non-Compliant': return 'status-non-compliant';
      case 'PendingOPI': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Rejected': return 'status-rejected';
      case 'OnHold': return 'bg-gray-100 text-gray-600';
      default: return 'status-draft';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F7]">
      {/* Duplicate Dossier Popup */}
      <AnimatePresence>
        {showDuplicatePopup.show && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Dossier déjà analysé</h3>
                  <p className="text-sm text-[#8E8E93]">
                    Le même dossier a été analysé. Référez-vous au menu rapport d'archivage pour consulter ou autorisez la soumission pour continuer l'analyse.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => {
                      setShowDuplicatePopup({ show: false });
                      setActiveTab('dossiers');
                    }}
                    className="w-full py-3 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-bold hover:bg-[#E5E5E7] transition-all"
                  >
                    Consulter l'archivage
                  </button>
                  <button 
                    onClick={() => {
                      setShowDuplicatePopup({ show: false });
                      // Continue analysis logic would go here if we bypassed
                      startActualAnalysis();
                    }}
                    className="w-full py-3 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-200"
                  >
                    Autoriser et continuer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-green-500 text-white border-green-400' : 
              toast.type === 'error' ? 'bg-red-500 text-white border-red-400' : 
              'bg-[#1D1D1F] text-white border-[#3A3A3C]'
            }`}>
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              <span className="text-sm font-bold">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-72 bg-white border-r border-[#E5E5E7] flex flex-col z-20"
          >
            <div className="p-6 border-b border-[#E5E5E7] flex items-center gap-3">
              <div className="w-10 h-10 bg-[#007AFF] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">CEMAC Regional</h1>
                <p className="text-xs text-[#8E8E93] font-medium">Compliance Platform</p>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavItem 
                icon={<BarChart3 size={20} />} 
                label="Tableau de bord" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')}
              />
              <NavItem 
                icon={<PlusCircle size={20} />} 
                label="Nouveau dossier" 
                active={activeTab === 'new_dossier'} 
                onClick={() => setActiveTab('new_dossier')}
              />
              <NavItem 
                icon={<Files size={20} />} 
                label="Dossiers" 
                active={activeTab === 'dossiers'} 
                onClick={() => setActiveTab('dossiers')}
              />
              <NavItem 
                icon={<Send size={20} />} 
                label="Transmissions & Rapports" 
                active={activeTab === 'transmissions'} 
                onClick={() => setActiveTab('transmissions')}
              />
              <NavItem 
                icon={<Clock size={20} />} 
                label="Appurement dossiers" 
                active={activeTab === 'appurement'} 
                onClick={() => setActiveTab('appurement')}
                badge={3}
              />
              <NavItem 
                icon={<PieChart size={20} />} 
                label="Reporting & Pilotage" 
                active={activeTab === 'reporting'} 
                onClick={() => setActiveTab('reporting')}
              />
              <NavItem 
                icon={<BookOpen size={20} />} 
                label="Réglementation" 
                active={activeTab === 'regulation'} 
                onClick={() => setActiveTab('regulation')}
              />
              <NavItem 
                icon={<BookOpen size={20} />} 
                label="Veille réglementaire" 
                active={activeTab === 'veille'} 
                onClick={() => setActiveTab('veille')}
              />

              {(userRole === 'admin' || userRole === 'super_admin') && (
                <>
                  <div className="pt-4 pb-2 px-4">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Administration</p>
                  </div>
                  <NavItem 
                    icon={<LayoutDashboard size={20} />} 
                    label="Dashboard Admin" 
                    active={activeTab === 'admin_dashboard'} 
                    onClick={() => setActiveTab('admin_dashboard')}
                  />
                  <NavItem 
                    icon={<Users size={20} />} 
                    label="Gestion Utilisateurs" 
                    active={activeTab === 'admin_users'} 
                    onClick={() => setActiveTab('admin_users')}
                  />
                  <NavItem 
                    icon={<Building2 size={20} />} 
                    label="Gestion Banques" 
                    active={activeTab === 'admin_banks'} 
                    onClick={() => setActiveTab('admin_banks')}
                  />
                  <NavItem 
                    icon={<CreditCard size={20} />} 
                    label="Facturation & Plans" 
                    active={activeTab === 'admin_billing'} 
                    onClick={() => setActiveTab('admin_billing')}
                  />
                  <NavItem 
                    icon={<Settings size={20} />} 
                    label="Configuration Système" 
                    active={activeTab === 'admin_settings'} 
                    onClick={() => setActiveTab('admin_settings')}
                  />
                </>
              )}
            </nav>

            <div className="p-4 border-t border-[#E5E5E7] space-y-4">
              <div className="bg-[#F5F5F7] p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">R</div>
                  <div>
                    <p className="text-xs font-bold">Ramadan</p>
                    <p className="text-[10px] text-[#8E8E93]">srh07sr@gmail.com</p>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-[#007AFF]">Agent Guichet</p>
              </div>
              <button 
                onClick={logout}
                className="flex items-center gap-3 w-full p-3 text-[#8E8E93] hover:text-[#1D1D1F] transition-colors rounded-lg hover:bg-[#F5F5F7]"
              >
                <LogOut size={20} />
                <span className="font-medium">Déconnexion</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-[#E5E5E7] flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#8E8E93]"
            >
              <Menu size={20} />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher un dossier..." 
                className="pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-[#007AFF] transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#8E8E93] relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{user.displayName || 'Utilisateur'}</p>
                <p className="text-xs text-[#8E8E93]">{user.email}</p>
              </div>
              <img 
                src={user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'U')} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Tableau de bord</h2>
                  <p className="text-[#8E8E93] mt-1">Plateforme régionale (6 pays) — Conformité des transferts CEMAC</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    label="DOSSIERS TOTAUX" 
                    value={dossiers.length.toString()} 
                    icon={<FileText size={20} />} 
                    onClick={() => { setActiveTab('dossiers'); setDossierStatusFilter('Tous les statuts'); }}
                  />
                  <StatCard 
                    label="TAUX DE CONFORMITÉ" 
                    value={dossiers.length > 0 ? `${Math.round((dossiers.filter(d => d.status === 'Compliant').length / dossiers.length) * 100)}%` : "0%"} 
                    icon={<BarChart3 size={20} />} 
                    trend="up" 
                    onClick={() => { setActiveTab('dossiers'); setDossierStatusFilter('Compliant'); }}
                  />
                  <StatCard 
                    label="DOSSIERS EN ALERTE" 
                    value={dossiers.filter(d => d.status === 'Incoherent' || d.status === 'Non-Compliant').length.toString()} 
                    icon={<Bell size={20} />} 
                    onClick={() => { setActiveTab('dossiers'); setDossierStatusFilter('Incoherent'); }}
                  />
                  <StatCard 
                    label="ALERTES CRITIQUES" 
                    value={dossiers.filter(d => d.status === 'Rejected').length.toString()} 
                    icon={<AlertTriangle size={20} />} 
                    onClick={() => { setActiveTab('dossiers'); setDossierStatusFilter('Rejected'); }}
                  />
                </div>

                <div className="card overflow-hidden">
                  <div className="p-6 border-b border-[#E5E5E7] flex items-center gap-2">
                    <BarChart3 size={18} className="text-[#007AFF]" />
                    <h3 className="font-bold text-sm">Dossiers récents</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F5F5F7] border-b border-[#E5E5E7]">
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Référence</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Client</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Type</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Montant</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Score</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {dossiers.length > 0 ? (
                          dossiers.slice(0, 8).map(d => (
                            <DashboardRow 
                              key={d.id}
                              reference={d.reference} 
                              client={d.clientName} 
                              type={d.transferType} 
                              amount={`${d.amount.toLocaleString()} ${d.currency}`} 
                              score={d.score || null} 
                              status={d.status} 
                            />
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-[#8E8E93]">Aucun dossier récent</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-start gap-3">
                  <Clock size={20} className="text-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-800">Rappel : Règle des 72h</p>
                    <p className="text-xs text-orange-700">Les dossiers au statut "Incomplet" non complétés sous 72h seront automatiquement archivés conformément à la procédure interne.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'new_dossier' && (
              <div className="max-w-3xl mx-auto space-y-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Nouveau dossier</h2>
                  <p className="text-[#8E8E93] mt-1">Créer un nouveau dossier de transfert (6 pays CEMAC)</p>
                </div>

                <div className="flex items-center justify-center gap-4 mb-8">
                  <StepIndicator step={1} current={newDossierStep} label="Informations" />
                  <ChevronRight size={16} className="text-[#E5E5E7]" />
                  <StepIndicator step={2} current={newDossierStep} label="Documents" />
                  <ChevronRight size={16} className="text-[#E5E5E7]" />
                  <StepIndicator step={3} current={newDossierStep} label="Vérification" />
                </div>

                <div className="card p-8 space-y-6">
                  {newDossierStep === 1 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-[#1D1D1F]">Nom du client</label>
                          <input 
                            type="text" 
                            value={newDossierData.clientName}
                            onChange={(e) => setNewDossierData({...newDossierData, clientName: e.target.value})}
                            placeholder="Ex: SAHEL TRADING SARL" 
                            className="w-full p-4 bg-[#F5F5F7] border-none rounded-xl text-base" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-[#1D1D1F]">Pays</label>
                          <select 
                            value={newDossierData.country}
                            onChange={(e) => setNewDossierData({...newDossierData, country: e.target.value})}
                            className="w-full p-4 bg-[#F5F5F7] border-none rounded-xl text-base appearance-none"
                          >
                            <option value="">Sélectionner le pays</option>
                            <option value="Cameroun">Cameroun</option>
                            <option value="Centrafrique">Centrafrique</option>
                            <option value="Congo">Congo</option>
                            <option value="Gabon">Gabon</option>
                            <option value="Guinée Équatoriale">Guinée Équatoriale</option>
                            <option value="Tchad">Tchad</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-[#1D1D1F]">Type de transfert</label>
                        <select 
                          value={newDossierData.transferType}
                          onChange={(e) => setNewDossierData({...newDossierData, transferType: e.target.value})}
                          className="w-full p-4 bg-[#F5F5F7] border-none rounded-xl text-base appearance-none"
                        >
                          <option value="">Sélectionner le type de transfert</option>
                          <option value="Achat de biens">Achat de biens</option>
                          <option value="Achat de services">Achat de services</option>
                          <option value="Assistance technique">Assistance technique</option>
                          <option value="Revenus du travail - Salaires">Revenus du travail - Salaires</option>
                          <option value="Revenus du travail - Honoraires">Revenus du travail - Honoraires</option>
                          <option value="Revenus du travail - Per diems & indemnités">Revenus du travail - Per diems & indemnités</option>
                          <option value="Aide familiale - Études / Scolarité">Aide familiale - Études / Scolarité</option>
                          <option value="Aide familiale - Subsistance">Aide familiale - Subsistance</option>
                          <option value="Aide familiale - Maladie">Aide familiale - Maladie</option>
                          <option value="Règlement de loyers">Règlement de loyers</option>
                          <option value="Remboursement d'emprunt">Remboursement d'emprunt</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-[#1D1D1F]">Montant</label>
                          <input 
                            type="text" 
                            value={newDossierData.amount}
                            onChange={(e) => setNewDossierData({...newDossierData, amount: e.target.value})}
                            placeholder="45 000 000" 
                            className="w-full p-4 bg-[#F5F5F7] border-none rounded-xl text-base" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-[#1D1D1F]">Devise</label>
                          <select 
                            value={newDossierData.currency}
                            onChange={(e) => setNewDossierData({...newDossierData, currency: e.target.value})}
                            className="w-full p-4 bg-[#F5F5F7] border-none rounded-xl text-base appearance-none"
                          >
                            <option value="XAF">XAF (FCFA)</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>

                      {newDossierData.transferType && CHECKLISTS[newDossierData.transferType] && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <div className="p-6 bg-[#F5F5F7] rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-base font-bold flex items-center gap-2">
                                <BookOpen size={18} className="text-[#007AFF]" />
                                Pièces requises ({REGULATORY_REFERENCES.CIRCULAR_LETTER})
                              </h4>
                              <span className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">
                                {CHECKLISTS[newDossierData.transferType].length} documents requis
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {CHECKLISTS[newDossierData.transferType].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm text-[#1D1D1F]">
                                  <div className="w-2 h-2 rounded-full bg-[#007AFF] mt-1.5 flex-shrink-0" />
                                  <span className="leading-relaxed font-medium">{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                            <AlertTriangle size={24} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-red-800">Avertissement Réglementaire</p>
                              <p className="text-xs text-red-700 leading-relaxed">{REGULATORY_REFERENCES.WARNING_MESSAGE}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      <button 
                        onClick={() => setNewDossierStep(2)}
                        disabled={!newDossierData.clientName || !newDossierData.transferType || !newDossierData.amount}
                        className="w-full py-3 bg-[#007AFF] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                      >
                        Continuer <ArrowRight size={18} />
                      </button>
                    </div>
                  )}

                  {newDossierStep === 2 && (
                    <div className="space-y-6">
                      <div className="bg-white border border-[#E5E5E7] rounded-3xl p-8 space-y-6">
                        <div>
                          <h3 className="text-xl font-bold text-[#1D1D1F]">Upload des documents</h3>
                          <p className="text-[#8E8E93] mt-1">
                            Glissez-déposez ou sélectionnez les pièces justificatives du dossier. L'IA classifiera automatiquement chaque document.
                          </p>
                        </div>

                        <BulkUploadZone 
                          onFilesSelected={handleBulkFiles}
                          isProcessing={isBulkProcessing}
                        />

                        {bulkProcessingResults.length > 0 && (
                          <div className="space-y-3 mt-6">
                            <h4 className="font-bold text-sm text-[#8E8E93] uppercase tracking-wider">Résultats de l'analyse</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                              {bulkProcessingResults.map((res, idx) => (
                                <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${res.status === 'success' ? 'bg-green-50 border-green-100' : res.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    {res.status === 'processing' ? (
                                      <div className="w-5 h-5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                    ) : res.status === 'success' ? (
                                      <Check size={18} className="text-green-600 flex-shrink-0" />
                                    ) : (
                                      <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
                                    )}
                                    <div className="overflow-hidden">
                                      <p className="text-sm font-bold truncate">{res.fileName}</p>
                                      <p className={`text-xs ${res.status === 'success' ? 'text-green-600' : res.status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                                        {res.message}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-[#E5E5E7]">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-sm flex items-center gap-2">
                              <FileText size={18} className="text-[#007AFF]" />
                              État du dossier
                            </h4>
                            <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
                              {Object.keys(files).length} / {CHECKLISTS[newDossierData.transferType as keyof typeof CHECKLISTS]?.length || 0} documents identifiés
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {CHECKLISTS[newDossierData.transferType as keyof typeof CHECKLISTS]?.map((item, idx) => (
                              <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${files[item] ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                                {files[item] ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                                <span className="truncate">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={() => setNewDossierStep(1)}
                          className="px-8 py-3 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-bold hover:bg-[#E5E5E7] transition-all"
                        >
                          Retour
                        </button>
                        <button 
                          onClick={() => setNewDossierStep(3)}
                          disabled={Object.keys(files).length === 0 || isBulkProcessing}
                          className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                        >
                          Continuer <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {newDossierStep === 3 && (
                    <div className="space-y-6">
                      {isAnalyzing ? (
                        <div className="p-12 text-center space-y-8">
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 border-4 border-[#F5F5F7] rounded-full" />
                            <motion.div 
                              className="absolute inset-0 border-4 border-[#007AFF] rounded-full border-t-transparent"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-[#007AFF] rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
                              <ShieldCheck size={12} /> GESS_IA v2.0 Active
                            </div>
                            <h3 className="text-2xl font-bold">Analyse IA en cours...</h3>
                            <p className="text-[#8E8E93]">{currentFileAnalyzing || `Le moteur de conformité GESS_IA analyse les ${Object.keys(files).length} document(s) soumis`}</p>
                          </div>
                          <div className="max-w-md mx-auto">
                            <div className="w-full bg-[#F5F5F7] h-2 rounded-full overflow-hidden mb-6">
                              <motion.div 
                                className="h-full bg-[#007AFF]"
                                initial={{ width: 0 }}
                                animate={{ width: `${analysisProgress}%` }}
                              />
                            </div>
                            <div className="text-left p-6 bg-[#F5F5F7] rounded-2xl space-y-3">
                              {ANALYSIS_CHECKS.map((check, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-sm text-[#1D1D1F]">
                                  <div className={`w-2 h-2 rounded-full ${analysisProgress > (idx + 1) * (100 / ANALYSIS_CHECKS.length) ? 'bg-green-500' : 'bg-[#007AFF]'}`} />
                                  {check}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <h3 className="font-bold text-lg">Récapitulatif du dossier</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">CLIENT</p>
                              <p className="text-sm font-bold">{newDossierData.clientName}</p>
                            </div>
                            <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">PAYS</p>
                              <p className="text-sm font-bold">{newDossierData.country}</p>
                            </div>
                            <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">TYPE</p>
                              <p className="text-sm font-bold">{newDossierData.transferType}</p>
                            </div>
                            <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">MONTANT</p>
                              <p className="text-sm font-bold">{newDossierData.amount} {newDossierData.currency}</p>
                            </div>
                            <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">DOCUMENTS</p>
                              <p className="text-sm font-bold">{Object.keys(files).length} fichier(s)</p>
                            </div>
                            <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                              <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">PIÈCES REQUISES</p>
                              <p className="text-sm font-bold">{CHECKLISTS[newDossierData.transferType]?.length || 0}</p>
                            </div>
                          </div>

                          <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                            <div className="flex items-center gap-2 text-[#007AFF]">
                              <span role="img" aria-label="robot">🤖</span>
                              <h4 className="font-bold text-sm">Analyse IA — Le moteur de conformité GESS_IA va analyser ce dossier :</h4>
                            </div>
                            <div className="space-y-2">
                              {ANALYSIS_CHECKS.map((check, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-xs text-blue-800">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
                                  {check}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <button 
                              onClick={() => setNewDossierStep(2)}
                              className="px-8 py-3 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-bold hover:bg-[#E5E5E7] transition-all"
                            >
                              Retour
                            </button>
                            <button 
                              onClick={handleAnalyze}
                              className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-100"
                            >
                              Soumettre pour analyse IA
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {newDossierStep === 4 && result && (
                    <div className="space-y-8">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-6">
                          <div className="relative w-20 h-20">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                              <path
                                className="text-[#F5F5F7] stroke-current"
                                strokeWidth="3"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                              <path
                                className="text-[#FF9500] stroke-current"
                                strokeWidth="3"
                                strokeDasharray={`${result.score}, 100`}
                                strokeLinecap="round"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-xs font-bold text-[#8E8E93]">Score IA</span>
                              <span className="text-xl font-bold">{result.score}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Décision</p>
                            <div className="px-3 py-1 bg-[#FF3B30] text-white text-xs font-bold rounded-lg uppercase tracking-wider">
                              {result.status === 'Non-Compliant' ? 'NON CONFORME' : result.status}
                            </div>
                          </div>
                        </div>
                      </div>

                      {result.kycToleranceApplied && (
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 text-blue-700">
                          <Info size={20} className="shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-bold">Tolérance KYC appliquée</p>
                            <p>{result.kycToleranceMessage}</p>
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-[#FFF9F2] border border-[#FFE5CC] rounded-xl flex items-center gap-3 text-[#FF9500]">
                        <AlertTriangle size={20} />
                        <div className="text-xs">
                          <p className="font-bold">Dossier non conforme avec alertes majeures</p>
                          <p>Vous pouvez transmettre ce dossier au responsable OPI pour accord de validation.</p>
                          {result.amountFiguresDeclared !== result.amountFigures && (
                            <div className="mt-2 p-3 bg-white border border-[#FF3B30] rounded-lg text-[#FF3B30] space-y-1">
                              <p className="font-bold flex items-center gap-1">
                                <AlertCircle size={14} /> Incohérence de montant détectée
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <p className="opacity-70">MONTANT DÉCLARÉ</p>
                                  <p className="font-bold">{result.amountFiguresDeclared?.toLocaleString()} {newDossierData.currency}</p>
                                </div>
                                <div>
                                  <p className="opacity-70">MONTANT EXTRAIT (IA)</p>
                                  <p className="font-bold">{result.amountFigures.toLocaleString()} {newDossierData.currency}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {result.penaltyRisk && (
                            <p className="mt-2 p-2 bg-[#FF3B30] text-white rounded font-bold">
                              {result.penaltyRisk}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-6 bg-white border border-[#E5E5E7] rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 text-[#1D1D1F]">
                          <AlertCircle size={18} className="text-[#FF3B30]" />
                          <h4 className="font-bold text-sm">Actions sur le dossier non conforme</h4>
                        </div>
                        <p className="text-xs text-[#8E8E93]">Mettez le dossier en attente pour permettre au client de corriger, ou rejetez le définitivement.</p>
                        <div className="flex flex-wrap gap-3">
                          <button 
                            onClick={() => handleCreateDossier('OnHold')}
                            className="px-4 py-2 bg-white border border-[#E5E5E7] text-[#1D1D1F] text-xs font-bold rounded-lg hover:bg-[#F5F5F7] transition-all flex items-center gap-2"
                          >
                            <Clock size={14} /> Mettre en attente
                          </button>
                          <button 
                            onClick={() => handleCreateDossier('PendingOPI')}
                            className="px-4 py-2 bg-[#007AFF] text-white text-xs font-bold rounded-lg hover:bg-[#0056B3] transition-all flex items-center gap-2 shadow-sm"
                          >
                            <Send size={14} /> Transmettre au Responsable OPI
                          </button>
                          <button 
                            onClick={() => handleCreateDossier('Rejected')}
                            className="px-4 py-2 bg-[#FF3B30] text-white text-xs font-bold rounded-lg hover:bg-[#D70015] transition-all flex items-center gap-2"
                          >
                            <XCircle size={14} /> Rejeter le dossier
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                          <AlertTriangle size={18} className="text-[#FF9500]" />
                          Alertes de conformité ({result.alerts.length})
                        </h4>
                        <div className="space-y-3">
                          {result.alerts.map((alert, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border ${
                              alert.severity === 'Critique' ? 'bg-[#FFF2F2] border-[#FFD9D9] text-[#FF3B30]' : 
                              alert.severity === 'Majeur' ? 'bg-[#FFF9F2] border-[#FFE5CC] text-[#FF9500]' : 
                              'bg-[#F2F9FF] border-[#D9EFFF] text-[#007AFF]'
                            }`}>
                              <div className="flex items-start gap-3">
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                                  alert.severity === 'Critique' ? 'bg-[#FF3B30] text-white' : 
                                  alert.severity === 'Majeur' ? 'bg-[#FF9500] text-white' : 
                                  'bg-[#007AFF] text-white'
                                }`}>
                                  {alert.severity}
                                </div>
                                <div className="space-y-1 flex-1">
                                  <p className="text-xs font-medium leading-relaxed">{alert.message}</p>
                                  {alert.reference && <p className="text-[10px] opacity-70">{alert.reference}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-bold text-sm">Documents manquants</h4>
                        <div className="space-y-2">
                          {result.missingDocuments?.map((doc, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-[#FF9500]">
                              <Clock size={14} />
                              <span className="font-bold uppercase tracking-wider">{doc}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-bold text-sm">Documents analysés ({result.analyzedDocuments.length})</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {result.analyzedDocuments.map((doc, idx) => (
                            <div key={idx} className="p-4 bg-white border border-[#E5E5E7] rounded-xl flex items-center justify-between group hover:border-[#007AFF] transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#F5F5F7] rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-all">
                                  <FileText className="text-[#8E8E93] group-hover:text-[#007AFF]" size={20} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold truncate max-w-[150px]">{doc.name}</p>
                                  <p className="text-[10px] text-[#8E8E93]">{doc.type}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all flex items-center gap-1">
                                  <Eye size={14} /> <span className="text-[10px] font-bold">Voir</span>
                                </button>
                                <button className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all">
                                  <Download size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-8 border-t border-[#E5E5E7] space-y-4">
                        <div className="flex items-center gap-2 text-[#1D1D1F]">
                          <FileText size={18} className="text-[#007AFF]" />
                          <h4 className="font-bold text-sm">Rapport de non-conformité</h4>
                        </div>
                        <p className="text-xs text-[#8E8E93]">Téléchargez le rapport détaillé des alertes et statuts de chaque document, ou envoyez-le directement par email.</p>
                        <div className="flex gap-3">
                          <button className="px-4 py-2 bg-white border border-[#E5E5E7] text-[#1D1D1F] text-xs font-bold rounded-lg hover:bg-[#F5F5F7] transition-all flex items-center gap-2">
                            <Download size={14} /> Télécharger (.txt)
                          </button>
                          <button className="px-4 py-2 bg-white border border-[#E5E5E7] text-[#1D1D1F] text-xs font-bold rounded-lg hover:bg-[#F5F5F7] transition-all flex items-center gap-2">
                            <Download size={14} /> Télécharger (.pdf)
                          </button>
                          <button className="px-4 py-2 bg-white border border-[#E5E5E7] text-[#1D1D1F] text-xs font-bold rounded-lg hover:bg-[#F5F5F7] transition-all flex items-center gap-2">
                            <Mail size={14} /> Envoyer par email
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-8">
                        <button 
                          onClick={() => setNewDossierStep(3)}
                          className="px-8 py-3 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-bold hover:bg-[#E5E5E7] transition-all"
                        >
                          Retour
                        </button>
                        <button 
                          onClick={handleCreateDossier}
                          className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-100"
                        >
                          Finaliser et créer le dossier
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'dossiers' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Liste des dossiers</h2>
                    <p className="text-[#8E8E93] mt-1">Gérer et suivre tous les dossiers de transfert</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('new_dossier')}
                    className="btn-primary flex items-center gap-2"
                  >
                    <PlusCircle size={18} /> Nouveau dossier
                  </button>
                </div>

                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-[#E5E5E7] flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
                      <input type="text" placeholder="Rechercher par référence, client..." className="w-full pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-lg text-sm" />
                    </div>
                    <select 
                      value={dossierStatusFilter}
                      onChange={(e) => setDossierStatusFilter(e.target.value)}
                      className="p-2 bg-white border border-[#E5E5E7] rounded-lg text-sm font-medium"
                    >
                      <option value="Tous les statuts">Tous les statuts</option>
                      <option value="Compliant">Compliant</option>
                      <option value="Incoherent">Incoherent</option>
                      <option value="Rejected">Rejected</option>
                      <option value="PendingOPI">PendingOPI</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F5F5F7] border-b border-[#E5E5E7]">
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Référence</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Client</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Type</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Montant</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Date</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Statut</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {dossiers
                          .filter(d => dossierStatusFilter === 'Tous les statuts' || d.status === dossierStatusFilter)
                          .map(d => (
                          <tr key={d.id} className="border-b border-[#E5E5E7] hover:bg-[#F5F5F7] transition-colors">
                            <td className="p-4">
                              <button 
                                onClick={() => handleViewDossier(d)}
                                className="font-bold text-[#007AFF] hover:underline"
                              >
                                {d.reference}
                              </button>
                            </td>
                            <td className="p-4 font-medium">{d.clientName}</td>
                            <td className="p-4 text-[#8E8E93]">{d.transferType}</td>
                            <td className="p-4 font-bold">{d.amount.toLocaleString()} {d.currency}</td>
                            <td className="p-4 text-[#8E8E93]">{d.createdAt?.toDate().toLocaleDateString()}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(d.status)}`}>
                                {d.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleViewDossier(d)}
                                  className="p-1.5 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all"
                                >
                                  <Eye size={16} />
                                </button>
                                <button className="p-1.5 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all">
                                  <Download size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reporting' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Reporting & Pilotage</h2>
                    <p className="text-[#8E8E93] mt-1">Analyses statistiques et indicateurs de performance</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setToast({ message: "Génération du rapport PDF...", type: 'info' });
                        setTimeout(() => setToast({ message: "Rapport PDF téléchargé.", type: 'success' }), 2000);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E5E7] rounded-xl text-xs font-bold hover:bg-[#F5F5F7] transition-all"
                    >
                      <Download size={14} /> PDF
                    </button>
                    <button 
                      onClick={() => {
                        setToast({ message: "Exportation des données Excel...", type: 'info' });
                        setTimeout(() => setToast({ message: "Export Excel terminé.", type: 'success' }), 2000);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E5E7] rounded-xl text-xs font-bold hover:bg-[#F5F5F7] transition-all"
                    >
                      <Download size={14} /> Excel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <BarChart3 size={18} className="text-[#007AFF]" />
                      Volume de transferts par type
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Biens', value: dossiers.filter(d => d.transferType === 'Achat de biens').length },
                          { name: 'Services', value: dossiers.filter(d => d.transferType === 'Achat de services').length },
                          { name: 'Scolarité', value: dossiers.filter(d => d.transferType === 'Aide familiale - Études / Scolarité').length },
                          { name: 'Maladie', value: dossiers.filter(d => d.transferType === 'Aide familiale - Maladie').length },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E7" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="value" fill="#007AFF" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <PieChart size={18} className="text-[#007AFF]" />
                      Répartition par statut de conformité
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={[
                              { name: 'Conforme', value: dossiers.filter(d => d.status === 'Compliant').length },
                              { name: 'Incohérent', value: dossiers.filter(d => d.status === 'Incoherent').length },
                              { name: 'Rejeté', value: dossiers.filter(d => d.status === 'Rejected').length },
                              { name: 'Attente OPI', value: dossiers.filter(d => d.status === 'PendingOPI').length },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#34C759" />
                            <Cell fill="#FF9500" />
                            <Cell fill="#FF3B30" />
                            <Cell fill="#AF52DE" />
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'users' && (userRole === 'audit' || userRole === 'control')) && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Gestion des Utilisateurs - {userProfile?.bankName}</h2>
                    <p className="text-[#8E8E93] mt-1">Gérez les accès pour votre établissement</p>
                  </div>
                  <button className="btn-primary flex items-center gap-2">
                    <PlusCircle size={18} /> Créer un utilisateur
                  </button>
                </div>

                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-[#E5E5E7] flex items-center justify-between bg-[#F5F5F7]">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={14} />
                      <input type="text" placeholder="Rechercher un utilisateur..." className="w-full pl-9 pr-4 py-1.5 bg-white border border-[#E5E5E7] rounded-lg text-xs" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F5F5F7] border-b border-[#E5E5E7]">
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Utilisateur</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Rôle</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Statut</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {allUsers.filter(u => u.bankId === userProfile?.bankId).map(u => (
                          <tr key={u.id} className="border-b border-[#E5E5E7] hover:bg-[#F5F5F7] transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center font-bold text-xs">
                                  {u.email[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold">{u.email}</p>
                                  <p className="text-[10px] text-[#8E8E93]">{u.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-blue-50 text-[#007AFF] text-[10px] font-bold rounded uppercase tracking-wider">
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${u.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {u.isActive ? 'Actif' : 'Inactif'}
                              </span>
                            </td>
                            <td className="p-4">
                              <button className="p-2 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all">
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {allUsers.filter(u => u.bankId === userProfile?.bankId).length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-[#8E8E93]">Aucun utilisateur trouvé pour votre banque</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'veille' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Veille réglementaire</h2>
                    <p className="text-[#8E8E93] mt-1">Accédez aux textes officiels et guides de conformité CEMAC en temps réel</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
                      <input 
                        type="text" 
                        placeholder="Rechercher un texte..." 
                        value={veilleSearchQuery}
                        onChange={(e) => setVeilleSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white border border-[#E5E5E7] rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all w-64"
                      />
                    </div>
                    <button 
                      onClick={fetchVeilleUpdates}
                      disabled={isCheckingVeille}
                      className="flex items-center gap-2 px-6 py-2 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                      {isCheckingVeille ? (
                        <>
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Clock size={18} />
                          </motion.div>
                          Recherche...
                        </>
                      ) : (
                        <>
                          <Search size={18} />
                          Actualiser
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {lastVeilleCheck && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-blue-800 text-sm">
                      <ShieldCheck size={20} className="text-[#007AFF]" />
                      <span>Dernière vérification en temps réel effectuée le <strong>{lastVeilleCheck}</strong></span>
                    </div>
                    <div className="text-[10px] font-bold text-[#007AFF] uppercase tracking-wider">Source: BEAC / COBAC / Journal Officiel</div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {veilleNews.length > 0 ? (
                    veilleNews
                      .filter(news => news.title.toLowerCase().includes(veilleSearchQuery.toLowerCase()) || news.desc.toLowerCase().includes(veilleSearchQuery.toLowerCase()))
                      .map((news, idx) => (
                        <VeilleCard 
                          key={idx}
                          title={news.title} 
                          desc={news.desc} 
                          date={news.date}
                          icon={<ShieldCheck size={24} className="text-[#007AFF]" />}
                          onClick={() => {
                            // Scroll to report
                            const reportEl = document.getElementById('veille-report');
                            reportEl?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        />
                      ))
                  ) : (
                    <>
                      <VeilleCard 
                        title="Arrêté 084 / BEAC" 
                        desc="Réglementation relative aux transferts de fonds hors zone CEMAC. Texte de base pour la conformité." 
                        date="Dernière mise à jour : 2024"
                        icon={<BookOpen size={24} className="text-[#007AFF]" />}
                        onClick={() => window.open('https://www.beac.int', '_blank')}
                      />
                      <VeilleCard 
                        title="Guide de l'Appurement" 
                        desc="Procédures et délais pour l'appurement des dossiers d'importation. Instruction 007/GR/2019." 
                        date="Version 2.1"
                        icon={<FileSearch size={24} className="text-[#007AFF]" />}
                        onClick={() => window.open('https://www.beac.int', '_blank')}
                      />
                      <VeilleCard 
                        title="Lutte anti-blanchiment" 
                        desc="Directives COBAC sur la vigilance et la déclaration de soupçon (LAB/CFT)." 
                        date="Janvier 2025"
                        icon={<ShieldCheck size={24} className="text-[#007AFF]" />}
                        onClick={() => window.open('https://www.cobac.int', '_blank')}
                      />
                    </>
                  )}
                </div>

                {veilleNews.length > 0 && (
                  <div id="veille-report" className="p-8 bg-white border border-[#E5E5E7] rounded-3xl space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#007AFF]">
                          <BookOpen size={20} />
                        </div>
                        <h3 className="text-xl font-bold">Rapport détaillé de la veille IA</h3>
                      </div>
                      <button 
                        onClick={() => {
                          const blob = new Blob([veilleNews[0].fullText], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Veille_Reglementaire_${new Date().toLocaleDateString()}.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#007AFF] hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Download size={14} /> Télécharger le rapport
                      </button>
                    </div>
                    <div className="prose prose-sm max-w-none text-[#1D1D1F]">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed bg-[#F5F5F7] p-6 rounded-2xl border border-[#E5E5E7]">
                        {veilleNews[0].fullText}
                      </div>
                    </div>
                    {veilleNews[0].sources.length > 0 && (
                      <div className="pt-6 border-t border-[#E5E5E7]">
                        <h4 className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider mb-3">Sources consultées :</h4>
                        <div className="flex flex-wrap gap-2">
                          {veilleNews[0].sources.map((url: string, i: number) => (
                            <a 
                              key={i} 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-white border border-[#E5E5E7] text-[#007AFF] text-[10px] font-bold rounded-lg hover:border-[#007AFF] transition-all flex items-center gap-2"
                            >
                              <Eye size={12} /> {new URL(url).hostname}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transmissions' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Transmissions & Validations OPI</h2>
                    <p className="text-[#8E8E93] mt-1">Dossiers en attente de validation par le responsable OPI</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="card p-6 bg-blue-50 border-blue-100 space-y-2">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">En attente OPI</p>
                    <h3 className="text-3xl font-bold text-blue-700">{dossiers.filter(d => d.status === 'PendingOPI').length}</h3>
                    <p className="text-xs text-blue-600">Dossiers nécessitant une validation manuelle</p>
                  </div>
                  <div className="card p-6 bg-green-50 border-green-100 space-y-2">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Validés ce mois</p>
                    <h3 className="text-3xl font-bold text-green-700">{dossiers.filter(d => d.opiValidationStatus === 'Approved').length}</h3>
                    <p className="text-xs text-green-600">Dossiers approuvés par le responsable OPI</p>
                  </div>
                  <div className="card p-6 bg-red-50 border-red-100 space-y-2">
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Rejetés ce mois</p>
                    <h3 className="text-3xl font-bold text-red-700">{dossiers.filter(d => d.opiValidationStatus === 'Rejected').length}</h3>
                    <p className="text-xs text-red-600">Dossiers refusés pour non-conformité majeure</p>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-[#E5E5E7] bg-[#F5F5F7]">
                    <h3 className="font-bold text-sm">Dossiers en attente de validation</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F5F5F7] border-b border-[#E5E5E7]">
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Référence</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Client</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Montant</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Date Transmission</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Statut OPI</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {dossiers.filter(d => d.status === 'PendingOPI').map(d => (
                          <tr key={d.id} className="border-b border-[#E5E5E7] hover:bg-[#F5F5F7] transition-colors">
                            <td className="p-4 font-bold text-[#007AFF]">{d.reference}</td>
                            <td className="p-4 font-medium">{d.clientName}</td>
                            <td className="p-4 font-bold">{d.amount.toLocaleString()} {d.currency}</td>
                            <td className="p-4 text-[#8E8E93]">{d.updatedAt?.toDate().toLocaleString()}</td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                En attente
                              </span>
                            </td>
                            <td className="p-4">
                              <button 
                                onClick={() => handleViewDossier(d)}
                                className="px-4 py-1.5 bg-[#007AFF] text-white text-[10px] font-bold rounded-lg hover:bg-[#0056B3] transition-all"
                              >
                                Examiner
                              </button>
                            </td>
                          </tr>
                        ))}
                        {dossiers.filter(d => d.status === 'PendingOPI').length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-[#8E8E93]">Aucun dossier en attente de validation OPI</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appurement' && (
              <div className="space-y-8">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-[#007AFF]">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Appurement de Dossiers</h2>
                      <p className="text-[#8E8E93] mt-1 text-sm">Suivi post-traitement — Délais BEAC : 3 mois (biens) / 1 mois (services)</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCardMini 
                    label="TOTAL SUIVIS" 
                    value="6" 
                    icon={<Files size={16} />} 
                    onClick={() => setAppurementFilter('Tous')}
                    active={appurementFilter === 'Tous'}
                  />
                  <StatCardMini 
                    label="NON TRAITÉS" 
                    value="1" 
                    icon={<Clock size={16} />} 
                    onClick={() => setAppurementFilter('Non traités')}
                    active={appurementFilter === 'Non traités'}
                  />
                  <StatCardMini 
                    label="EN COURS" 
                    value="3" 
                    icon={<Clock size={16} />} 
                    onClick={() => setAppurementFilter('En cours')}
                    active={appurementFilter === 'En cours'}
                  />
                  <StatCardMini 
                    label="EN RETARD" 
                    value="1" 
                    icon={<AlertTriangle size={16} />} 
                    onClick={() => setAppurementFilter('En retard')}
                    active={appurementFilter === 'En retard'}
                  />
                  <StatCardMini 
                    label="MIS EN DEMEURE" 
                    value="1" 
                    icon={<Send size={16} />} 
                    onClick={() => setAppurementFilter('Mis en demeure')}
                    active={appurementFilter === 'Mis en demeure'}
                  />
                  <StatCardMini 
                    label="APURÉS" 
                    value="0" 
                    icon={<CheckCircle size={16} />} 
                    onClick={() => setAppurementFilter('Apurés')}
                    active={appurementFilter === 'Apurés'}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 border-b border-[#E5E5E7]">
                    <button className="pb-3 px-4 text-sm font-bold border-b-2 border-[#007AFF] text-[#1D1D1F]">Suivi d'appurement (3)</button>
                    <button className="pb-3 px-4 text-sm font-bold text-[#8E8E93] hover:text-[#1D1D1F]">Dossiers non suivis (0)</button>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
                      <input 
                        type="text" 
                        placeholder="Rechercher par référence ou client..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E5E7] rounded-lg text-sm" 
                        value={appurementSearch}
                        onChange={(e) => setAppurementSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-1 bg-[#F5F5F7] p-1 rounded-lg">
                      {['Tous', 'Non traités', 'En cours', 'En retard', 'Mis en demeure'].map((f) => (
                        <FilterBtn 
                          key={f} 
                          label={f} 
                          active={appurementFilter === f} 
                          onClick={() => setAppurementFilter(f)} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { ref: "OV-2026-00007", client: "ETS EXCELLENCE", type: "Achat de biens — 99 377,7 EUR", status: "En cours", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00008", client: "ETS SIRIBA", type: "Achat de biens — 496 679 EUR", status: "En cours", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00010", client: "COMPANY SOLEIL LEVANT", type: "Achat de biens — 151 425 EUR", status: "En cours", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00012", client: "SOCIETE AGRO", type: "Achat de services — 45 000 EUR", status: "Non traités", deadline: "SERVICE — 1 mois" },
                      { ref: "OV-2026-00005", client: "GLOBAL TRADING", type: "Achat de biens — 250 000 EUR", status: "En retard", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00003", client: "IMPORT EXPORT SARL", type: "Achat de biens — 120 000 EUR", status: "Mis en demeure", deadline: "BIEN — 3 mois" },
                    ]
                    .filter(d => (appurementFilter === 'Tous' || d.status === appurementFilter) && 
                                 (d.ref.toLowerCase().includes(appurementSearch.toLowerCase()) || d.client.toLowerCase().includes(appurementSearch.toLowerCase())))
                    .map(d => (
                      <AppurementItem 
                        key={d.ref}
                        reference={d.ref} 
                        client={d.client} 
                        type={d.type} 
                        status={d.status} 
                        deadline={d.deadline}
                        onClick={() => setShowAppurementModal(d.ref)}
                      />
                    ))}
                    {([
                      { ref: "OV-2026-00007", client: "ETS EXCELLENCE", type: "Achat de biens — 99 377,7 EUR", status: "En cours", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00008", client: "ETS SIRIBA", type: "Achat de biens — 496 679 EUR", status: "En cours", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00010", client: "COMPANY SOLEIL LEVANT", type: "Achat de biens — 151 425 EUR", status: "En cours", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00012", client: "SOCIETE AGRO", type: "Achat de services — 45 000 EUR", status: "Non traités", deadline: "SERVICE — 1 mois" },
                      { ref: "OV-2026-00005", client: "GLOBAL TRADING", type: "Achat de biens — 250 000 EUR", status: "En retard", deadline: "BIEN — 3 mois" },
                      { ref: "OV-2026-00003", client: "IMPORT EXPORT SARL", type: "Achat de biens — 120 000 EUR", status: "Mis en demeure", deadline: "BIEN — 3 mois" },
                    ].filter(d => (appurementFilter === 'Tous' || d.status === appurementFilter) && 
                                 (d.ref.toLowerCase().includes(appurementSearch.toLowerCase()) || d.client.toLowerCase().includes(appurementSearch.toLowerCase()))).length === 0) && (
                      <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-[#E5E5E7]">
                        <p className="text-[#8E8E93] text-sm">Aucun dossier trouvé pour ce filtre ou cette recherche.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'regulation' && (
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-[#007AFF]">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Bibliothèque Réglementaire</h2>
                    <p className="text-[#8E8E93] mt-1 text-sm">Accédez aux textes officiels et guides de conformité CEMAC intégrés à l'IA</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{REGULATORY_REFERENCES.CIRCULAR_LETTER}</h3>
                          <p className="text-[10px] text-[#8E8E93] uppercase tracking-wider">Texte de référence BEAC</p>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#007AFF] transition-all">
                        <Download size={18} />
                      </button>
                    </div>
                    <p className="text-xs text-[#8E8E93] leading-relaxed">
                      Ce document définit les modalités de transfert de fonds hors de la zone CEMAC, incluant les listes de pièces justificatives par nature de transaction.
                    </p>
                    <div className="pt-4 border-t border-[#E5E5E7] flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase tracking-wider">
                      <ShieldCheck size={14} /> Intégré au moteur GESS_IA
                    </div>
                  </div>

                  <div className="card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#007AFF]">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{REGULATORY_REFERENCES.DECREE}</h3>
                          <p className="text-[10px] text-[#8E8E93] uppercase tracking-wider">Réglementation de change</p>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#007AFF] transition-all">
                        <Download size={18} />
                      </button>
                    </div>
                    <p className="text-xs text-[#8E8E93] leading-relaxed">
                      Réglementation relative aux opérations de change et aux transferts de fonds. Définit les sanctions et pénalités en cas de non-conformité.
                    </p>
                    <div className="pt-4 border-t border-[#E5E5E7] flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase tracking-wider">
                      <ShieldCheck size={14} /> Intégré au moteur GESS_IA
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 p-6 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle size={20} />
                    <h4 className="font-bold text-sm">Rappel des Sanctions (Pénalité de {REGULATORY_REFERENCES.PENALTY_RATE})</h4>
                  </div>
                  <p className="text-xs text-red-800 leading-relaxed">
                    Conformément à la réglementation de change, tout manquement à la soumission des documents justificatifs requis ou toute inexactitude dans les informations fournies expose l'établissement assujetti à une <strong>pénalité de {REGULATORY_REFERENCES.PENALTY_RATE}</strong> du montant de l'opération.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg">Check-lists par type de transfert</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.keys(CHECKLISTS).map((type) => (
                      <div key={type} className="card p-4 hover:border-[#007AFF] transition-all cursor-pointer group">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-[#1D1D1F] group-hover:text-[#007AFF]">{type}</h4>
                          <ChevronRight size={14} className="text-[#8E8E93]" />
                        </div>
                        <p className="text-[10px] text-[#8E8E93]">{CHECKLISTS[type].length} documents requis</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transmissions' && (
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-[#007AFF]">
                    <Send size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Transmissions & Rapports</h2>
                    <p className="text-[#8E8E93] mt-1 text-sm">Suivi de vos dossiers soumis, décisions OPI et documents physiques</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <StatCardMini label="Total" value="10" icon={<Files size={16} className="text-[#007AFF]" />} />
                  <StatCardMini label="En attente OPI" value="2" icon={<Clock size={16} className="text-orange-500" />} />
                  <StatCardMini label="Validés & transmis" value="2" icon={<CheckCircle size={16} className="text-green-500" />} />
                  <StatCardMini label="Rejetés" value="4" icon={<X size={16} className="text-red-500" />} />
                  <StatCardMini label="Docs physiques" value="2" icon={<FileText size={16} className="text-orange-500" />} />
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4 border-b border-[#E5E5E7]">
                    <button className="pb-3 px-4 text-sm font-bold border-b-2 border-[#007AFF] text-[#1D1D1F] flex items-center gap-2">
                      <Files size={16} /> Dossiers (10)
                    </button>
                    <button className="pb-3 px-4 text-sm font-bold text-[#8E8E93] hover:text-[#1D1D1F] flex items-center gap-2">
                      <BarChart3 size={16} /> Rapports
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={16} />
                      <input type="text" placeholder="Rechercher par référence ou client..." className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E5E7] rounded-lg text-sm" />
                    </div>
                    <select className="p-2 bg-white border border-[#E5E5E7] rounded-lg text-sm font-medium">
                      <option>Statut (tous)</option>
                    </select>
                  </div>

                  <div className="space-y-4">
                    <TransmissionItem 
                      ref="OV-2026-00015" 
                      status="Rejeté" 
                      client="COMP SOLEIL LEVAN" 
                      details="Achat de biens · Tchad · 151 425 EUR" 
                      date="Soumis le 07/03/2026"
                      alert={{
                        title: "Rejeté par l'OPI · 07/03/2026",
                        message: "03 dossiers incomplets",
                        action: "Veuillez corriger le dossier et le soumettre à nouveau"
                      }}
                    />
                    <TransmissionItem 
                      ref="OV-2026-00014" 
                      status="Incomplet" 
                      client="COMP SOLEIL LEVAN" 
                      details="Achat de biens · Tchad · 151 425 EUR" 
                      date="Soumis le 07/03/2026"
                    />
                    <TransmissionItem 
                      ref="OV-2026-00013" 
                      status="Incomplet" 
                      client="COMP SOLEIL LEVAN" 
                      details="Achat de services · Tchad · 151 429 EUR" 
                      date="Soumis le 28/02/2026"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin_dashboard' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Dashboard Super Admin</h2>
                  <p className="text-[#8E8E93] mt-1">Vue globale de la plateforme GESS-IA (Toutes banques)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="BANQUES ACTIVES" value={allBanks.length.toString()} icon={<Building2 size={20} className="text-[#007AFF]" />} />
                  <StatCard label="UTILISATEURS TOTAUX" value={allUsers.length.toString()} icon={<Users size={20} className="text-[#007AFF]" />} />
                  <StatCard label="DOSSIERS ANALYSÉS" value="1,284" icon={<FileSearch size={20} className="text-[#007AFF]" />} trend="up" />
                  <StatCard label="REVENUS MENSUELS" value="12,500 €" icon={<CreditCard size={20} className="text-green-500" />} trend="up" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <BarChart3 size={18} className="text-[#007AFF]" />
                      Volume de dossiers par banque
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'BGFIBank', value: 450 },
                          { name: 'Afriland', value: 380 },
                          { name: 'Société Générale', value: 290 },
                          { name: 'EcoBank', value: 164 },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E7" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#007AFF" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card p-6 space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <PieChart size={18} className="text-[#007AFF]" />
                      Répartition par pays CEMAC
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={[
                              { name: 'Cameroun', value: 40 },
                              { name: 'Gabon', value: 25 },
                              { name: 'Tchad', value: 15 },
                              { name: 'Congo', value: 10 },
                              { name: 'RCA', value: 5 },
                              { name: 'Guinée Éq.', value: 5 },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#007AFF" />
                            <Cell fill="#5856D6" />
                            <Cell fill="#FF9500" />
                            <Cell fill="#FF3B30" />
                            <Cell fill="#34C759" />
                            <Cell fill="#AF52DE" />
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin_users' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Gestion des Utilisateurs</h2>
                    <p className="text-[#8E8E93] mt-1">Gérez les accès et les rôles des utilisateurs de la plateforme</p>
                  </div>
                  <button className="btn-primary flex items-center gap-2">
                    <PlusCircle size={18} /> Inviter un utilisateur
                  </button>
                </div>

                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-[#E5E5E7] flex items-center justify-between bg-[#F5F5F7]">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={14} />
                      <input type="text" placeholder="Rechercher un utilisateur..." className="w-full pl-9 pr-4 py-1.5 bg-white border border-[#E5E5E7] rounded-lg text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <FilterBtn label="Tous" active />
                      <FilterBtn label="Admin" />
                      <FilterBtn label="Agent" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F5F5F7] border-b border-[#E5E5E7]">
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Utilisateur</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Rôle</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Banque</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Dernière connexion</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Statut</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {allUsers.map(u => (
                          <UserRow key={u.id} user={u} />
                        ))}
                        {allUsers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-[#8E8E93]">Aucun utilisateur trouvé</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin_banks' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Gestion des Banques</h2>
                    <p className="text-[#8E8E93] mt-1">Configurez les établissements bancaires partenaires</p>
                  </div>
                  <button className="btn-primary flex items-center gap-2">
                    <PlusCircle size={18} /> Ajouter une banque
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allBanks.map(bank => (
                    <BankCard key={bank.id} bank={bank} />
                  ))}
                  <div className="card p-8 border-2 border-dashed border-[#E5E5E7] flex flex-col items-center justify-center text-center space-y-4 hover:border-[#007AFF] transition-all cursor-pointer group">
                    <div className="w-12 h-12 bg-[#F5F5F7] rounded-full flex items-center justify-center text-[#8E8E93] group-hover:text-[#007AFF] transition-all">
                      <PlusCircle size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Nouvelle Banque</p>
                      <p className="text-xs text-[#8E8E93]">Ajouter un nouvel établissement</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin_billing' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Facturation & Plans</h2>
                  <p className="text-[#8E8E93] mt-1">Gérez les abonnements et suivez la consommation des banques</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="card p-6 space-y-4 border-l-4 border-[#007AFF]">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Plan Premium</p>
                    <h3 className="text-2xl font-bold">1,250 € <span className="text-sm font-normal text-[#8E8E93]">/ mois</span></h3>
                    <p className="text-xs text-[#8E8E93]">Abonnement standard pour 10 agents</p>
                    <div className="pt-4 flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">Actif</span>
                      <span className="text-[10px] text-[#8E8E93]">Prochaine facture : 01/04/2026</span>
                    </div>
                  </div>
                  <div className="card p-6 space-y-4">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Consommation IA</p>
                    <h3 className="text-2xl font-bold">842 <span className="text-sm font-normal text-[#8E8E93]">/ 1,000</span></h3>
                    <p className="text-xs text-[#8E8E93]">Analyses effectuées ce mois-ci</p>
                    <div className="w-full h-2 bg-[#F5F5F7] rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-[#007AFF]" style={{ width: '84.2%' }} />
                    </div>
                  </div>
                  <div className="card p-6 space-y-4">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Dernière Facture</p>
                    <h3 className="text-2xl font-bold">1,250.00 €</h3>
                    <p className="text-xs text-[#8E8E93]">Payée le 01/03/2026</p>
                    <button className="text-[10px] font-bold text-[#007AFF] uppercase tracking-wider flex items-center gap-1 hover:underline">
                      <Download size={12} /> Télécharger le PDF
                    </button>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  <div className="p-6 border-b border-[#E5E5E7]">
                    <h3 className="font-bold text-sm">Historique des factures</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F5F5F7] border-b border-[#E5E5E7]">
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">N° Facture</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Date</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Montant</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Statut</th>
                          <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr className="border-b border-[#E5E5E7]">
                          <td className="p-4 font-bold">INV-2026-003</td>
                          <td className="p-4 text-[#8E8E93]">01/03/2026</td>
                          <td className="p-4 font-bold">1,250.00 €</td>
                          <td className="p-4"><span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">Payée</span></td>
                          <td className="p-4"><button className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#007AFF]"><Download size={16} /></button></td>
                        </tr>
                        <tr className="border-b border-[#E5E5E7]">
                          <td className="p-4 font-bold">INV-2026-002</td>
                          <td className="p-4 text-[#8E8E93]">01/02/2026</td>
                          <td className="p-4 font-bold">1,250.00 €</td>
                          <td className="p-4"><span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">Payée</span></td>
                          <td className="p-4"><button className="p-2 hover:bg-[#F5F5F7] rounded-lg text-[#007AFF]"><Download size={16} /></button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin_settings' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Configuration Système</h2>
                  <p className="text-[#8E8E93] mt-1">Paramètres globaux du moteur GESS-IA et de la plateforme</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="card p-6 space-y-6">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <ShieldCheck size={18} className="text-[#007AFF]" />
                      Paramètres IA & Conformité
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Seuil de score critique</p>
                          <p className="text-xs text-[#8E8E93]">Alerte automatique si le score est inférieur à</p>
                        </div>
                        <input type="number" defaultValue={60} className="w-16 p-2 bg-[#F5F5F7] border-none rounded-lg text-sm font-bold text-center" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Vérification SWIFT automatique</p>
                          <p className="text-xs text-[#8E8E93]">Activer la reconnaissance des messages MT298</p>
                        </div>
                        <div className="w-10 h-6 bg-[#007AFF] rounded-full relative cursor-pointer">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Détection CamScanner</p>
                          <p className="text-xs text-[#8E8E93]">Rejeter automatiquement les scans mobiles</p>
                        </div>
                        <div className="w-10 h-6 bg-[#E5E5E7] rounded-full relative cursor-pointer">
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card p-6 space-y-6">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Bell size={18} className="text-[#007AFF]" />
                      Notifications & Alertes
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Alertes OPI par Email</p>
                          <p className="text-xs text-[#8E8E93]">Notifier les agents lors d'un rejet OPI</p>
                        </div>
                        <div className="w-10 h-6 bg-[#007AFF] rounded-full relative cursor-pointer">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Rappels d'appurement</p>
                          <p className="text-xs text-[#8E8E93]">Envoyer des rappels à J-15 de l'échéance</p>
                        </div>
                        <div className="w-10 h-6 bg-[#007AFF] rounded-full relative cursor-pointer">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <button className="px-6 py-2 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl text-sm font-bold hover:bg-[#E5E5E7] transition-all">
                    Réinitialiser
                  </button>
                  <button className="px-6 py-2 bg-[#007AFF] text-white rounded-xl text-sm font-bold hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-100">
                    Enregistrer les modifications
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Appurement Modal */}
      <AnimatePresence>
        {showAppurementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAppurementModal(null); setShowMiseEnDemeure(false); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-[#E5E5E7] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold">Appurement — {showAppurementModal}</h3>
                  <p className="text-sm text-[#8E8E93] font-medium">ETS EXCELLENCE — Achat de biens</p>
                </div>
                <button onClick={() => { setShowAppurementModal(null); setAppurementDocs({}); setShowMiseEnDemeure(false); }} className="p-2 hover:bg-[#F5F5F7] rounded-full text-[#8E8E93]">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">STATUT</p>
                    <span className="px-3 py-1 bg-blue-50 text-[#007AFF] text-xs font-bold rounded-lg border border-blue-100">En cours</span>
                  </div>
                  <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">ÉCHÉANCE</p>
                    <p className="text-sm font-bold">21/05/2026</p>
                    <p className="text-xs text-green-600 font-bold">58 jours restants</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-[#007AFF]" />
                      <h4 className="font-bold text-sm">Documents requis (BEAC)</h4>
                    </div>
                    {!showMiseEnDemeure && (
                      <button 
                        onClick={() => setShowMiseEnDemeure(true)}
                        className="text-[10px] font-bold text-[#007AFF] hover:underline"
                      >
                        Difficultés à obtenir les documents ?
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <RequiredDocItem 
                      title="LTA (Lettre de Transport Aérien) ou BL (Bill of Lading/Connaissement)" 
                      desc="Document de transport attestant de l'expédition des biens." 
                      expectedType="Lettre de Transport Aérien (LTA) ou Bill of Lading (BL)"
                      onUpload={(uploaded) => setAppurementDocs(prev => ({ ...prev, doc1: uploaded }))}
                    />
                    <RequiredDocItem 
                      title="Facture définitive" 
                      desc="Facture commerciale finale des biens achetés." 
                      expectedType="Facture commerciale définitive"
                      onUpload={(uploaded) => setAppurementDocs(prev => ({ ...prev, doc2: uploaded }))}
                    />
                    <RequiredDocItem 
                      title="Attestation de dédouanement" 
                      desc="Preuve que les biens ont été dédouanés dans le pays de destination." 
                      expectedType="Attestation de dédouanement (Quittance Douane)"
                      onUpload={(uploaded) => setAppurementDocs(prev => ({ ...prev, doc3: uploaded }))}
                    />
                    <RequiredDocItem 
                      title="Attestation d'arrivée de marchandise" 
                      desc="Document confirmant la réception physique des biens." 
                      expectedType="Attestation d'arrivée de marchandise"
                      onUpload={(uploaded) => setAppurementDocs(prev => ({ ...prev, doc4: uploaded }))}
                    />
                    {showMiseEnDemeure && (
                      <RequiredDocItem 
                        title="Lettre de mise en demeure sous huitaine" 
                        desc="Document signé et cacheté par le client et la banque en cas de retard." 
                        expectedType="Lettre de mise en demeure"
                        onUpload={(uploaded) => setAppurementDocs(prev => ({ ...prev, miseEnDemeure: uploaded }))}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#8E8E93]">PROGRESSION DE L'APPUREMENT</span>
                    <span className="text-[#007AFF]">{Object.values(appurementDocs).filter(Boolean).length} / 4 documents</span>
                  </div>
                  <div className="bg-blue-50 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#007AFF]"
                      initial={{ width: "25%" }}
                      animate={{ width: `${(Object.values(appurementDocs).filter(Boolean).length / 4) * 100}%` }}
                    />
                  </div>
                </div>

                <button 
                  disabled={!(Object.values(appurementDocs).filter(Boolean).length >= 4 || appurementDocs.miseEnDemeure)}
                  onClick={() => {
                    const isComplete = Object.values(appurementDocs).filter(Boolean).length >= 4;
                    const message = isComplete 
                      ? "Dossier d'appurement finalisé et transmis à la BEAC !" 
                      : "Dossier d'appurement partiel (Mise en demeure) transmis à la BEAC !";
                    setToast({ message, type: 'success' });
                    setShowAppurementModal(null);
                    setAppurementDocs({});
                    setShowMiseEnDemeure(false);
                  }}
                  className="w-full py-4 bg-[#007AFF] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#0056B3] transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:bg-gray-200 disabled:shadow-none"
                >
                  {appurementDocs.miseEnDemeure && Object.values(appurementDocs).filter(Boolean).length < 4 
                    ? "Soumettre l'appurement partiel" 
                    : "Finaliser l'appurement"} <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {isDetailModalOpen && selectedDossier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-[#E5E5E7] flex items-center justify-between bg-[#F5F5F7]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <FileText className="text-[#007AFF]" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Dossier {selectedDossier.reference}</h3>
                    <p className="text-xs text-[#8E8E93] font-medium">Créé le {selectedDossier.createdAt?.toDate().toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 hover:bg-[#E5E5E7] rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <section className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#8E8E93]">Informations Générales</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                          <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Client</p>
                          <p className="font-bold">{selectedDossier.clientName}</p>
                        </div>
                        <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                          <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Pays de destination</p>
                          <p className="font-bold">{selectedDossier.country}</p>
                        </div>
                        <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                          <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Type de transfert</p>
                          <p className="font-bold">{selectedDossier.transferType}</p>
                        </div>
                        <div className="p-4 bg-[#F5F5F7] rounded-2xl">
                          <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Montant</p>
                          <p className="font-bold text-lg text-[#007AFF]">{selectedDossier.amount.toLocaleString()} {selectedDossier.currency}</p>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-[#8E8E93]">Documents Associés</h4>
                        <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg uppercase tracking-wider">
                          {selectedDossier.files?.length || 0} Fichiers
                        </span>
                      </div>
                      <div className="space-y-3">
                        {selectedDossier.analyzedDocuments ? (
                          selectedDossier.analyzedDocuments.map((doc, idx) => (
                            <div key={idx} className="p-4 border border-[#E5E5E7] rounded-2xl flex items-center justify-between hover:bg-[#F5F5F7] transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white border border-[#E5E5E7] rounded-xl flex items-center justify-center text-[#8E8E93] group-hover:text-[#007AFF] group-hover:border-[#007AFF] transition-all">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold">{doc.name}</p>
                                  <p className="text-[10px] text-[#007AFF] font-bold uppercase tracking-wider">{doc.type}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  className="p-2 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all" 
                                  title="Visualiser"
                                  onClick={() => window.open(`https://picsum.photos/seed/${doc.name}/1200/800`, '_blank')}
                                >
                                  <Eye size={16} />
                                </button>
                                <button 
                                  className="p-2 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all" 
                                  title="Télécharger"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = `https://picsum.photos/seed/${doc.name}/1200/800`;
                                    link.download = doc.name;
                                    link.click();
                                  }}
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          selectedDossier.files?.map((fileName, idx) => (
                            <div key={idx} className="p-4 border border-[#E5E5E7] rounded-2xl flex items-center justify-between hover:bg-[#F5F5F7] transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white border border-[#E5E5E7] rounded-xl flex items-center justify-center text-[#8E8E93] group-hover:text-[#007AFF] group-hover:border-[#007AFF] transition-all">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold">{fileName}</p>
                                  <p className="text-[10px] text-[#8E8E93]">Document PDF</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  className="p-2 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all" 
                                  title="Visualiser"
                                  onClick={() => window.open(`https://picsum.photos/seed/${fileName}/1200/800`, '_blank')}
                                >
                                  <Eye size={16} />
                                </button>
                                <button 
                                  className="p-2 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all" 
                                  title="Télécharger"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = `https://picsum.photos/seed/${fileName}/1200/800`;
                                    link.download = fileName;
                                    link.click();
                                  }}
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        {selectedDossier.files && selectedDossier.files.length > 1 && (
                          <button 
                            onClick={() => {
                              setToast({ message: "Téléchargement de tous les fichiers en cours...", type: 'info' });
                              // Simulate bulk download
                              setTimeout(() => {
                                setToast({ message: "Archive ZIP téléchargée avec succès.", type: 'success' });
                              }, 1500);
                            }}
                            className="w-full py-3 bg-[#F5F5F7] text-[#1D1D1F] text-xs font-bold rounded-xl hover:bg-[#E5E5E7] transition-all flex items-center justify-center gap-2"
                          >
                            <Download size={14} /> Télécharger tous les fichiers (ZIP)
                          </button>
                        )}
                        {(!selectedDossier.files || selectedDossier.files.length === 0) && (
                          <div className="p-8 border-2 border-dashed border-[#E5E5E7] rounded-2xl text-center">
                            <p className="text-sm text-[#8E8E93]">Aucun fichier associé à ce dossier.</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-8">
                    <section className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#8E8E93]">Statut & Score IA</h4>
                      <div className="p-6 bg-white border border-[#E5E5E7] rounded-3xl shadow-sm space-y-6">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <div className="relative w-24 h-24">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                              <path
                                className="text-[#F5F5F7] stroke-current"
                                strokeWidth="3"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                              <path
                                className={`${selectedDossier.score && selectedDossier.score > 80 ? 'text-[#34C759]' : 'text-[#FF9500]'} stroke-current`}
                                strokeWidth="3"
                                strokeDasharray={`${selectedDossier.score || 0}, 100`}
                                strokeLinecap="round"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-2xl font-bold">{selectedDossier.score || 0}</span>
                              <span className="text-[8px] font-bold text-[#8E8E93] uppercase">Score</span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(selectedDossier.status)}`}>
                            {selectedDossier.status}
                          </span>
                        </div>

                        {selectedDossier.status === 'PendingOPI' && (userRole === 'admin' || userRole === 'super_admin') && (
                          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 text-blue-700">
                              <ShieldCheck size={18} />
                              <h5 className="font-bold text-xs uppercase tracking-wider">Validation OPI Requise</h5>
                            </div>
                            <textarea 
                              placeholder="Motif de validation ou rejet (obligatoire pour rejet)..."
                              value={opiComment}
                              onChange={(e) => setOpiComment(e.target.value)}
                              className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs min-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => handleOPIValidation(selectedDossier.id!, 'Approved', opiComment)}
                                className="py-2 bg-green-500 text-white text-[10px] font-bold rounded-lg hover:bg-green-600 transition-all flex items-center justify-center gap-1"
                              >
                                <CheckCircle size={14} /> Approuver
                              </button>
                              <button 
                                onClick={() => {
                                  if (!opiComment) {
                                    setToast({ message: "Veuillez saisir un motif pour le rejet.", type: 'error' });
                                    return;
                                  }
                                  handleOPIValidation(selectedDossier.id!, 'Rejected', opiComment);
                                }}
                                className="py-2 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-all flex items-center justify-center gap-1"
                              >
                                <XCircle size={14} /> Rejeter
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedDossier.opiValidationStatus === 'Rejected' && (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-red-700">
                              <AlertTriangle size={16} />
                              <h5 className="font-bold text-[10px] uppercase tracking-wider">Motif du rejet OPI</h5>
                            </div>
                            <p className="text-xs text-red-800 italic">"{selectedDossier.opiValidationComment}"</p>
                            <p className="text-[10px] text-red-600">Par: {selectedDossier.opiValidatedBy}</p>
                          </div>
                        )}

                        {selectedDossier.physicalDocStatus && (
                          <div className={`p-4 rounded-2xl border space-y-3 ${selectedDossier.physicalDocStatus === 'Received' ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                            <div className="flex items-center gap-2">
                              <FileText size={18} className={selectedDossier.physicalDocStatus === 'Received' ? 'text-green-600' : 'text-orange-600'} />
                              <h5 className={`font-bold text-[10px] uppercase tracking-wider ${selectedDossier.physicalDocStatus === 'Received' ? 'text-green-700' : 'text-orange-700'}`}>
                                Documents Physiques : {selectedDossier.physicalDocStatus === 'Received' ? 'Reçus' : 'En attente'}
                              </h5>
                            </div>
                            
                            {selectedDossier.physicalDocStatus === 'Pending' && (userRole === 'admin' || userRole === 'super_admin') && (
                              <button 
                                onClick={() => handleConfirmPhysicalReceipt(selectedDossier.id!)}
                                className="w-full py-2 bg-orange-500 text-white text-[10px] font-bold rounded-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-1"
                              >
                                <CheckCircle size={14} /> Confirmer la réception
                              </button>
                            )}

                            {selectedDossier.physicalDocStatus === 'Received' && (
                              <div className="text-[10px] text-green-700 space-y-1">
                                <p>Reçus le : {selectedDossier.physicalDocReceivedAt?.toDate().toLocaleString()}</p>
                                <p>Par : {selectedDossier.physicalDocReceivedBy}</p>
                              </div>
                            )}

                            {selectedDossier.physicalDocStatus === 'Pending' && userRole === 'agent' && (
                              <p className="text-[10px] text-orange-700 italic">
                                Veuillez transmettre les documents physiques au responsable OPI.
                              </p>
                            )}
                          </div>
                        )}

                        <div className="space-y-3 pt-4 border-t border-[#E5E5E7]">
                          <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Actions rapides</p>
                          <button 
                            onClick={() => {
                              // Generate a report text
                              const report = `RAPPORT DE NON-CONFORMITÉ DÉTAILLÉ
Dossier: ${selectedDossier.reference}
Client: ${selectedDossier.clientName}
Statut: ${selectedDossier.status}
Score: ${selectedDossier.score}/100

ALERTE ET STATUTS:
${selectedDossier.status === 'Non-Compliant' ? '- Alerte Majeure: Dossier non conforme aux exigences BEAC' : '- Dossier en cours de traitement'}
- Vérification KYC: ${selectedDossier.score && selectedDossier.score > 70 ? 'Validé' : 'Alerte'}
- Vérification Montants: ${selectedDossier.status === 'Incoherent' ? 'Incohérence détectée' : 'Conforme'}

Généré le ${new Date().toLocaleString()}`;
                              
                              const blob = new Blob([report], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `Rapport_Non_Conformite_${selectedDossier.reference}.txt`;
                              link.click();
                              setToast({ message: "Rapport de non-conformité téléchargé.", type: 'success' });
                            }}
                            className="w-full py-2.5 bg-white border border-[#007AFF] text-[#007AFF] text-xs font-bold rounded-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Download size={14} /> Rapport de non-conformité
                          </button>
                          {selectedDossier.status === 'Non-Compliant' && (
                            <button 
                              onClick={() => handleTransmitToOPI(selectedDossier.id!)}
                              className="w-full py-2.5 bg-[#007AFF] text-white text-xs font-bold rounded-xl hover:bg-[#0056B3] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                            >
                              <Send size={14} /> Transmettre au Responsable OPI
                            </button>
                          )}
                          <button 
                            onClick={() => handlePutOnHold(selectedDossier.id!)}
                            className="w-full py-2.5 bg-white border border-[#E5E5E7] text-[#1D1D1F] text-xs font-bold rounded-xl hover:bg-[#F5F5F7] transition-all flex items-center justify-center gap-2"
                          >
                            <Clock size={14} /> Mettre en attente
                          </button>
                          <button 
                            onClick={() => handleReject(selectedDossier.id!)}
                            className="w-full py-2.5 bg-white border border-[#FF3B30] text-[#FF3B30] text-xs font-bold rounded-xl hover:bg-[#FFF2F2] transition-all flex items-center justify-center gap-2"
                          >
                            <XCircle size={14} /> Rejeter le dossier
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#8E8E93]">Historique</h4>
                      <div className="space-y-4 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E5E7]">
                        <div className="relative pl-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-white border-2 border-[#007AFF] rounded-full z-10" />
                          <p className="text-xs font-bold">Dossier créé</p>
                          <p className="text-[10px] text-[#8E8E93]">{selectedDossier.createdAt?.toDate().toLocaleString()}</p>
                        </div>
                        <div className="relative pl-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-white border-2 border-[#E5E5E7] rounded-full z-10" />
                          <p className="text-xs font-bold text-[#8E8E93]">Analyse IA effectuée</p>
                          <p className="text-[10px] text-[#8E8E93]">Score: {selectedDossier.score}/100</p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-[#E5E5E7] bg-[#F5F5F7] flex justify-end">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-2 bg-[#1D1D1F] text-white rounded-xl text-sm font-bold hover:bg-black transition-all"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const UserRow: React.FC<{ user: any }> = ({ user }) => {
  return (
    <tr className="border-b border-[#E5E5E7] hover:bg-[#F5F5F7] transition-colors">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'U'}`} alt="" className="w-8 h-8 rounded-full" />
          <div>
            <p className="font-bold text-xs">{user.displayName || 'Utilisateur'}</p>
            <p className="text-[10px] text-[#8E8E93]">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${user.role === 'super_admin' ? 'bg-purple-50 text-purple-600 border-purple-100' : user.role === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
          {user.role || 'user'}
        </span>
      </td>
      <td className="p-4 text-xs font-medium text-[#8E8E93]">
        {user.bankName || 'Non assigné'}
      </td>
      <td className="p-4 text-xs text-[#8E8E93]">
        {user.lastLogin?.toDate().toLocaleString() || 'Jamais'}
      </td>
      <td className="p-4">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Actif
        </span>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all"><Eye size={14} /></button>
          <button className="p-1.5 hover:bg-white rounded-lg text-[#8E8E93] hover:text-[#007AFF] transition-all"><Settings size={14} /></button>
        </div>
      </td>
    </tr>
  );
}

const BankCard: React.FC<{ bank: any }> = ({ bank }) => {
  return (
    <div className="card p-6 space-y-4 hover:border-[#007AFF] transition-all group">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 bg-[#F5F5F7] rounded-2xl flex items-center justify-center text-[#007AFF] group-hover:bg-[#007AFF] group-hover:text-white transition-all">
          <Building2 size={24} />
        </div>
        <button className="p-2 hover:bg-[#F5F5F7] rounded-full text-[#8E8E93]">
          <MoreVertical size={18} />
        </button>
      </div>
      <div>
        <h3 className="font-bold text-sm">{bank.name}</h3>
        <p className="text-xs text-[#8E8E93]">{bank.country} • {bank.userCount || 0} Utilisateurs</p>
      </div>
      <div className="pt-4 border-t border-[#E5E5E7] flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${bank.status === 'Active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
          {bank.status || 'Active'}
        </span>
        <button className="text-[10px] font-bold text-[#007AFF] uppercase tracking-wider hover:underline">Gérer</button>
      </div>
    </div>
  );
}

const VeilleCard: React.FC<{ title: string, desc: string, date: string, icon: React.ReactNode, onClick?: () => void }> = ({ title, desc, date, icon, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="card p-6 space-y-4 hover:border-[#007AFF] transition-all cursor-pointer group"
    >
      <div className="w-12 h-12 bg-[#F5F5F7] rounded-xl flex items-center justify-center group-hover:bg-[#007AFF] group-hover:text-white transition-all">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-sm group-hover:text-[#007AFF] transition-all">{title}</h3>
        <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">{desc}</p>
      </div>
      <div className="pt-4 border-t border-[#E5E5E7] flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{date}</span>
        <ArrowRight size={16} className="text-[#8E8E93] group-hover:text-[#007AFF] transition-all" />
      </div>
    </div>
  );
}
function NavItem({ icon, label, active = false, onClick, badge }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-between w-full p-3 rounded-xl transition-all font-medium ${active ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-200' : 'text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {badge && (
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-white text-[#007AFF]' : 'bg-[#007AFF] text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, icon, trend, onClick }: { label: string, value: string, icon: React.ReactNode, trend?: 'up' | 'down', onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={onClick}
      className={`card p-6 space-y-4 transition-all duration-300 hover:shadow-xl hover:border-[#007AFF]/20 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 bg-[#F5F5F7] rounded-xl flex items-center justify-center text-[#007AFF]">
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {trend === 'up' ? '↑ 12%' : '↓ 5%'}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}

function StatCardMini({ label, value, icon, onClick, active = false }: { label: string, value: string, icon: React.ReactNode, onClick?: () => void, active?: boolean }) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`card p-4 flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:border-[#007AFF]/20 ${onClick ? 'cursor-pointer' : ''} ${active ? 'border-[#007AFF] bg-blue-50/30 ring-1 ring-[#007AFF]/20' : ''}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${active ? 'bg-[#007AFF] text-white' : 'bg-[#F5F5F7] text-[#8E8E93]'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[8px] font-bold text-[#8E8E93] uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}

const DashboardRow: React.FC<{ reference: string, client: string, type: string, amount: string, score?: number | null, status: string }> = ({ reference, client, type, amount, score, status }) => {
  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'Compliant': return 'bg-green-50 text-green-600 border-green-100';
      case 'Incoherent': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Rejected': return 'bg-red-50 text-red-600 border-red-100';
      case 'Analyse IA': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'PendingOPI': return 'bg-purple-50 text-purple-600 border-purple-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  return (
    <tr className="border-b border-[#E5E5E7] hover:bg-[#F5F5F7] transition-colors">
      <td className="p-4 font-bold text-[#007AFF]">{reference}</td>
      <td className="p-4 font-medium">{client}</td>
      <td className="p-4 text-[#8E8E93]">{type}</td>
      <td className="p-4 font-bold">{amount}</td>
      <td className="p-4">
        {score !== null ? (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${score > 70 ? 'bg-green-500' : score > 40 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-[10px] font-bold">{score}%</span>
          </div>
        ) : (
          <span className="text-[10px] text-[#8E8E93] italic">En attente</span>
        )}
      </td>
      <td className="p-4">
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(status)}`}>
          {status}
        </span>
      </td>
    </tr>
  );
}

function StepIndicator({ step, current, label }: { step: number, current: number, label: string }) {
  const active = current === step;
  const completed = current > step;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-[#007AFF] text-white' : completed ? 'bg-green-500 text-white' : 'bg-[#E5E5E7] text-[#8E8E93]'}`}>
        {completed ? <Check size={12} /> : step}
      </div>
      <span className={`text-xs font-bold ${active ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>{label}</span>
    </div>
  );
}

function AppurementItem({ reference, client, type, status, deadline, onClick }: { reference: string, client: string, type: string, status: string, deadline: string, onClick?: () => void, key?: any }) {
  return (
    <div className="card p-6 flex items-center justify-between hover:border-[#007AFF] transition-all cursor-pointer group" onClick={onClick}>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">{reference}</span>
          <span className="px-2 py-0.5 bg-blue-50 text-[#007AFF] text-[10px] font-bold rounded border border-blue-100 flex items-center gap-1">
            <Clock size={10} /> {status}
          </span>
          <span className="px-2 py-0.5 bg-[#F5F5F7] text-[#1D1D1F] text-[10px] font-bold rounded border border-[#E5E5E7] flex items-center gap-1">
            <Files size={10} /> {deadline}
          </span>
        </div>
        <p className="font-bold text-sm">{client}</p>
        <p className="text-xs text-[#8E8E93] font-medium uppercase tracking-wider">{type}</p>
      </div>
      <button className="p-2 text-[#8E8E93] group-hover:text-[#007AFF] transition-colors">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function FilterBtn({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void, key?: any }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${active ? 'bg-[#007AFF] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-white/50'}`}
    >
      {label}
    </button>
  );
}

function RequiredDocItem({ title, desc, onUpload, onFileSelect, expectedType }: { 
  title: string; 
  desc: string; 
  onUpload?: (uploaded: boolean) => void; 
  onFileSelect?: (file: File | null) => void;
  expectedType?: string;
  key?: any;
}) {
  const [isUploaded, setIsUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("Fichier trop volumineux (Max. 10MB)");
        return;
      }

      setError(null);
      setAiMessage(null);
      setFileName(file.name);
      setIsUploading(true);
      setUploadProgress(10);
      setIsUploaded(false);
      onUpload?.(false);
      onFileSelect?.(file);

      if (expectedType) {
        setUploadProgress(40);
        const validation = await validateDocumentWithAI(file, expectedType);
        setUploadProgress(100);
        setIsUploading(false);
        
        if (validation.isValid) {
          setIsUploaded(true);
          setAiMessage(validation.message);
          onUpload?.(true);
        } else {
          setError(validation.message);
          onUpload?.(false);
        }
      } else {
        // Fallback simulation
        let progress = 10;
        const interval = setInterval(() => {
          progress += Math.random() * 25;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setIsUploading(false);
            setIsUploaded(true);
            onUpload?.(true);
          }
          setUploadProgress(progress);
        }, 400);
      }
    }
  };

  return (
    <div className={`p-4 border rounded-2xl flex flex-col gap-3 transition-all group ${isUploaded ? 'border-green-200 bg-green-50/30' : error ? 'border-red-200 bg-red-50/30' : 'border-[#E5E5E7] hover:bg-[#F5F5F7]'}`}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-start gap-4">
          <div className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isUploaded ? 'border-green-500 bg-green-500 text-white' : error ? 'border-red-500 bg-red-500 text-white' : 'border-[#E5E5E7] text-[#E5E5E7] group-hover:border-[#007AFF] group-hover:text-[#007AFF]'}`}>
            {isUploaded ? <Check size={12} /> : error ? <X size={12} /> : <Upload size={12} />}
          </div>
          <div>
            <p className="text-base font-bold">{title}</p>
            <p className="text-sm text-[#8E8E93] mt-1">{desc}</p>
            {fileName && !isUploading && !error && (
              <p className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
                <ShieldCheck size={12} /> {fileName} — {aiMessage || 'Vérifié par GESS_IA'}
              </p>
            )}
            {error && <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
            <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${isUploaded ? 'bg-green-100 text-green-600' : error ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
              {isUploaded ? 'Conforme' : error ? 'Non-Conforme' : 'Obligatoire'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''} ${isUploaded ? 'bg-white border border-green-200 text-green-600 hover:bg-green-50' : error ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : 'bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F]'}`}
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            ) : (
              isUploaded ? <Check size={16} /> : error ? <Upload size={16} /> : <Upload size={16} />
            )}
            {isUploading ? 'Analyse IA...' : (isUploaded ? 'Remplacer' : error ? 'Réessayer' : 'Charger')}
          </button>
        </div>
      </div>
      
      {isUploading && (
        <div className="w-full space-y-1">
          <div className="flex justify-between text-xs font-bold text-[#8E8E93]">
            <span>Analyse de {fileName} par GESS_IA...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full h-2 bg-[#E5E5E7] rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#007AFF]"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BulkUploadZone({ onFilesSelected, isProcessing }: { onFilesSelected: (files: File[]) => void, isProcessing: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div 
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 transition-all ${isProcessing ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-[#E5E5E7] hover:border-[#007AFF] hover:bg-blue-50/30 cursor-pointer'}`}
      onClick={() => !isProcessing && fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        multiple 
        accept=".pdf,.jpg,.jpeg,.png"
      />
      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-[#007AFF]">
        {isProcessing ? (
          <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload size={32} />
        )}
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-[#1D1D1F]">Cliquez pour sélectionner des fichiers</p>
        <p className="text-sm text-[#8E8E93] mt-1">PDF, Images, Word — Max 20 Mo</p>
        <p className="text-xs text-[#8E8E93] mt-2 italic">L'IA classifiera automatiquement chaque document.</p>
      </div>
    </div>
  );
}

function TransmissionItem({ ref, status, client, details, date, alert }: { ref: string, status: string, client: string, details: string, date: string, alert?: any }) {
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Rejeté': return 'bg-red-50 text-red-600 border-red-100';
      case 'Incomplet': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Analyse IA': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'PendingOPI': return 'bg-purple-50 text-purple-600 border-purple-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#007AFF] text-sm">{ref}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(status)}`}>{status}</span>
        </div>
        <div>
          <p className="font-bold text-sm">{client}</p>
          <p className="text-xs text-[#8E8E93] font-medium">{details}</p>
          <p className="text-[10px] text-[#8E8E93] mt-1">{date}</p>
        </div>
      </div>
      {alert && (
        <div className="bg-red-50 p-4 border-t border-red-100 space-y-2">
          <div className="flex items-center gap-2 text-red-600">
            <X size={16} className="bg-red-100 rounded-full p-0.5" />
            <p className="text-xs font-bold">{alert.title}</p>
          </div>
          <p className="text-xs text-red-700 ml-6">{alert.message}</p>
          <div className="flex items-center gap-2 text-orange-600 ml-6">
            <AlertTriangle size={14} />
            <p className="text-xs font-bold">{alert.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}


function DetailRow({ label, value, status }: { label: string, value: string, status?: 'success' | 'error' | 'warning' }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-[#E5E5E7] rounded-xl">
      <span className="text-xs font-bold text-[#8E8E93]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">{value}</span>
        {status === 'success' && <CheckCircle size={14} className="text-green-500" />}
        {status === 'error' && <AlertCircle size={14} className="text-red-500" />}
        {status === 'warning' && <AlertTriangle size={14} className="text-orange-500" />}
      </div>
    </div>
  );
}

function DetailRowLegacy({ label, status, message }: { label: string, status: boolean, message: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F5F5F7] transition-colors">
      <div className={`mt-0.5 ${status ? 'text-green-500' : 'text-red-500'}`}>
        {status ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold">{label}</p>
        <div className="text-sm text-[#8E8E93] leading-relaxed whitespace-pre-wrap">{message}</div>
      </div>
    </div>
  );
}

