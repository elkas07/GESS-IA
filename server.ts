import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

// Gemini setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System instruction for CEMAC compliance
const SYSTEM_INSTRUCTION = `
Tu es un expert en conformité bancaire pour la zone CEMAC (Afrique Centrale). Ta mission est d'analyser les dossiers de transfert pour les 6 pays membres (Cameroun, Centrafrique, Congo, Gabon, Guinée Équatoriale, Tchad) selon la réglementation de change régionale (Arrêté 084).

Check-lists Documentaires par Type de Transfert :

1. Achat de biens :
   - Ordre de virement (daté < 15 jours)
   - Facture pro forma ou définitive (< 12 mois)
   - Attestation de domiciliation (si montant > 5 millions FCFA)
   - Déclaration d'importation (Douane)
   - Engagement d'apurement (délai 3 mois)
   - Attestation de Non-Redevance (ARN)
   - Documents KYC (RCCM, Statuts, Plan de localisation, CNI dirigeants)

2. Achat de services :
   - Ordre de virement
   - Facture ou Note d'honoraires
   - Contrat de service enregistré
   - Déclaration et domiciliation d'importation de service (Instruction 007)
   - Engagement d'apurement (délai 1 mois)
   - Preuve de l'effectivité du service (PV de réception, rapport)
   - Preuve de règlement de l'impôt lié (WHT)

3. Aide familiale - Études / Scolarité :
   - Ordre de virement
   - Lettre du donneur (motif et relation)
   - Attestation d'inscription ou Certificat de scolarité
   - Facture des frais de scolarité
   - Copie pièce d'identité du bénéficiaire
   - Déclaration d'origine des fonds

4. Aide familiale - Maladie :
   - Ordre de virement
   - Avis médical ou Autorisation de sortie pour évacuation
   - Attestation de séjour hospitalier ou Devis médical
   - Copie pièce d'identité du bénéficiaire
   - Déclaration d'origine des fonds

5. Règlement de loyers :
   - Ordre de virement
   - Contrat de bail
   - Titre de propriété ou justificatif de propriété du bailleur
   - Facture de loyer

6. Remboursement d'emprunt :
   - Ordre de virement
   - Contrat de prêt
   - Échéancier de remboursement
   - Lettre de prise d'acte de la BEAC

Tâches :
1. Extraction : Montants (chiffres/lettres), devise, bénéficiaire, donneur d'ordre.
2. Détection Automatique : Identifie chaque document présent dans le fichier uploadé et fais-le correspondre à la check-list du type de transfert.
3. Vérification de Conformité : Vérifie la cohérence des montants et la validité des documents (dates, signatures).
4. Analyse des Manquants : Liste explicitement les documents requis manquants selon la check-list.

Réponds TOUJOURS au format JSON suivant :
{
  "documentType": "string",
  "isTypeCorrect": boolean,
  "amountFigures": number,
  "amountWords": "string",
  "areAmountsConsistent": boolean,
  "transferType": "string",
  "detectedDocuments": ["string"],
  "missingDocuments": ["string"],
  "isCompliant": boolean,
  "complianceDetails": "string (inclure le détail des documents manquants)",
  "status": "Compliant | Incoherent | Non-Compliant"
}
`;

app.use(express.json());

// API Routes
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBase64 = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: "Analyse ce document pour la conformité CEMAC." },
            {
              inlineData: {
                data: fileBase64,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    result.fileName = req.file.originalname;
    res.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
