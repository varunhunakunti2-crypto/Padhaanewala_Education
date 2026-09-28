import type { MockTest, MockTestQuestion } from "@/lib/types";

export interface QuestionBankItem {
  id: string;
  topic: string;
  subject: string;
  text: string;
  type?: "mcq" | "numeric";
  options: string[];
  correctIndex: number;
  numericAnswer?: number;
  explanation: string;
}

export const QUESTION_BANK: QuestionBankItem[] = [];

const bySubject = (subject: string) => QUESTION_BANK.filter((q) => q.subject === subject);

function pickDeterministic(seed: string, items: QuestionBankItem[], count: number): QuestionBankItem[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    let h = 0;
    const s = seed + i;
    for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) >>> 0;
    const j = h % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function seedId(slug: string, subject: string): string {
  return slug + "::" + subject;
}

/**
 * "Hardcore JEE Mock Test — Paper 2" (JEE Main 2026 pattern).
 *
 * Transcribed from `data/Hardcore_JEE_Mock_Paper_2_2026.pdf`, which the paper
 * itself describes as an original practice bank and *not* an official JEE
 * paper. Marking is JEE Main's: +4 correct, −1 incorrect, 0 unattempted, for
 * 75 questions × 4 = 300 marks in 180 minutes. Every subject carries 20 MCQs
 * followed by 5 numerical-value questions.
 *
 * Ordering is load-bearing: `MOCK_TESTS` derives its `questionIds` from the
 * array order, so the paper is served to the student exactly as printed.
 */
const PAPER_2_QUESTIONS: QuestionBankItem[] = [
  // ---------------- PHYSICS — Section A (MCQ, Q1–20) ----------------
  {
    id: "hp2-q1", subject: "Physics", topic: "Physics", text: "A photon of energy 5 eV ejects electrons from a metal of work function 2 eV. The stopping potential is:",
    options: ["2 V", "3 V", "5 V", "7 V"], correctIndex: 1,
    explanation: "Kmax = 5 − 2 = 3 eV = eVs, hence Vs = 3 V.",
  },
  {
    id: "hp2-q2", subject: "Physics", topic: "Physics", text: "In a series LCR circuit at resonance, the impedance is:",
    options: ["R", "√(R² + X_L²)", "X_L − X_C", "0"], correctIndex: 0,
    explanation: "At resonance X_L = X_C, so the net reactance is zero and Z = R.",
  },
  {
    id: "hp2-q3", subject: "Physics", topic: "Physics", text: "A uniform rod of length L and mass M is hinged at one end and released from rest from the horizontal. Its angular speed when it becomes vertical is:",
    options: ["√(g/L)", "√(2g/L)", "√(3g/L)", "√(6g/L)"], correctIndex: 2,
    explanation: "Loss of COM potential energy MgL/2 = (1/2)Iω² with I = ML²/3, so ω² = 3g/L.",
  },
  {
    id: "hp2-q4", subject: "Physics", topic: "Physics", text: "A simple pendulum has time period T at a place where g is known. If its length is increased by 44%, the percentage increase in T is approximately:",
    options: ["20%", "44%", "48.8%", "10%"], correctIndex: 0,
    explanation: "T ∝ √L, so T′/T = √1.44 = 1.2 — a 20% increase.",
  },
  {
    id: "hp2-q5", subject: "Physics", topic: "Physics", text: "A charged particle enters a uniform magnetic field perpendicular to its velocity. If its kinetic energy is quadrupled, its radius becomes:",
    options: ["unchanged", "doubled", "quadrupled", "halved"], correctIndex: 1,
    explanation: "r = p/(qB) and p ∝ √K, so r ∝ √K. Four times K gives twice r.",
  },
  {
    id: "hp2-q6", subject: "Physics", topic: "Physics", text: "A particle of mass m moving with speed v collides elastically head-on with a stationary particle of mass 3m. The speed of the incident particle after collision is:",
    options: ["v/2", "v/3", "−v/2", "−v/3"], correctIndex: 2,
    explanation: "For an elastic 1D collision, v₁′ = (m₁−m₂)/(m₁+m₂)·v = (m−3m)/(4m)·v = −v/2.",
  },
  {
    id: "hp2-q7", subject: "Physics", topic: "Physics", text: "A wire of resistance R is stretched uniformly to twice its original length without change of volume. Its new resistance is:",
    options: ["R/2", "R", "2R", "4R"], correctIndex: 3,
    explanation: "Volume is constant, so the area halves: R′ = ρ(2L)/(A/2) = 4R.",
  },
  {
    id: "hp2-q8", subject: "Physics", topic: "Physics", text: "A satellite is moved from a circular orbit of radius R to another circular orbit of radius 4R around Earth. The ratio of its orbital speeds is:",
    options: ["1:2", "2:1", "1:4", "4:1"], correctIndex: 1,
    explanation: "Orbital speed v = √(GM/r), so v_R / v_4R = 2, i.e. 2:1.",
  },
  {
    id: "hp2-q9", subject: "Physics", topic: "Physics", text: "A liquid rises to height h in a capillary of radius r. If the capillary radius is doubled and surface tension is unchanged, the new rise is:",
    options: ["h/4", "h/2", "2h", "4h"], correctIndex: 1,
    explanation: "Capillary rise h = 2T cosθ/(ρ g r), hence h ∝ 1/r.",
  },
  {
    id: "hp2-q10", subject: "Physics", topic: "Physics", text: "A block of mass m is on a rough horizontal surface (coefficient μ). A horizontal force F is applied. The block is just about to move when F = μmg. If the same force is instead applied at an angle θ above the horizontal, the least force required to start motion is:",
    options: ["μmg", "μmg/(1 − μ sinθ)", "μmg/(cosθ + μ sinθ)", "μmg/(cosθ − μ sinθ)"], correctIndex: 2,
    explanation: "At limiting motion F cosθ = μ(mg − F sinθ), so F(cosθ + μ sinθ) = μmg and F = μmg/(cosθ + μ sinθ).",
  },
  {
    id: "hp2-q11", subject: "Physics", topic: "Physics", text: "In Young's double-slit experiment, if both slit separation and wavelength are doubled, fringe width becomes:",
    options: ["half", "unchanged", "double", "four times"], correctIndex: 1,
    explanation: "Fringe width β = λD/d; doubling both λ and d leaves β unchanged.",
  },
  {
    id: "hp2-q12", subject: "Physics", topic: "Physics", text: "A coil of N turns and area A rotates with angular speed ω in uniform magnetic field B. The maximum induced emf is:",
    options: ["NBA", "NBAω", "BAω/N", "NB/Aω"], correctIndex: 1,
    explanation: "Flux = NAB cos ωt, so the maximum induced emf is NABω.",
  },
  {
    id: "hp2-q13", subject: "Physics", topic: "Physics", text: "For a p-n junction diode under forward bias, the depletion-layer width:",
    options: ["increases", "decreases", "remains exactly constant", "becomes infinite"], correctIndex: 1,
    explanation: "Forward bias lowers the barrier potential and narrows the depletion region.",
  },
  {
    id: "hp2-q14", subject: "Physics", topic: "Physics", text: "Two charges +q and +4q are separated by distance d. The electric field is zero at a point between them. Its distance from +q is:",
    options: ["d/2", "d/3", "d/4", "2d/3"], correctIndex: 1,
    explanation: "q/x² = 4q/(d−x)². Taking positive roots, d−x = 2x, so x = d/3.",
  },
  {
    id: "hp2-q15", subject: "Physics", topic: "Physics", text: "One mole of an ideal monatomic gas expands adiabatically until its volume doubles. If initial temperature is T, the final temperature is:",
    options: ["T/2", "T/2^(2/3)", "T/2^(5/3)", "2T"], correctIndex: 1,
    explanation: "TV^(γ−1) = constant with γ = 5/3, so T₂/T₁ = (V₁/V₂)^(2/3) = 2^(−2/3).",
  },
  {
    id: "hp2-q16", subject: "Physics", topic: "Physics", text: "A small block slides from rest down a smooth track through a vertical height h and enters a rough horizontal patch of length L with coefficient μ. It stops exactly at the far end. The required height is:",
    options: ["μL", "2μL", "μL/2", "L/(2μ)"], correctIndex: 0,
    explanation: "At the bottom the potential energy lost is mgh and the rough patch removes μmgL, so mgh = μmgL and h = μL.",
  },
  {
    id: "hp2-q17", subject: "Physics", topic: "Physics", text: "A particle moves on the x-axis with x(t) = t³ − 6t² + 9t (SI units). The total distance travelled during 0 ≤ t ≤ 4 s is:",
    options: ["4 m", "8 m", "12 m", "16 m"], correctIndex: 2,
    explanation: "v = 3(t−1)(t−3), so turning points are t = 1 and 3. x(0) = 0, x(1) = 4, x(3) = 0, x(4) = 4, giving a total distance of 4 + 4 + 4 = 12 m.",
  },
  {
    id: "hp2-q18", subject: "Physics", topic: "Physics", text: "A convex lens of focal length 20 cm forms a real image at 60 cm from the lens. The object distance is:",
    options: ["15 cm", "20 cm", "30 cm", "40 cm"], correctIndex: 2,
    explanation: "1/f = 1/v + 1/u, so 1/20 = 1/60 + 1/u, giving u = 30 cm.",
  },
  {
    id: "hp2-q19", subject: "Physics", topic: "Physics", text: "Two masses m and 2m are connected by a light string over a frictionless pulley. The tension in the string is:",
    options: ["2mg/3", "4mg/3", "3mg/2", "2mg"], correctIndex: 1,
    explanation: "Acceleration a = (2m−m)g/(3m) = g/3. For m, T − mg = ma, so T = 4mg/3.",
  },
  {
    id: "hp2-q20", subject: "Physics", topic: "Physics", text: "A capacitor C charged to potential V is connected in parallel to an uncharged capacitor 2C. The final common potential is:",
    options: ["V/2", "V/3", "2V/3", "V"], correctIndex: 1,
    explanation: "Charge conservation: CV = (3C)V_f, so V_f = V/3.",
  },

  // ---------------- PHYSICS — Section B (numerical, Q21–25) ----------------
  {
    id: "hp2-q21", subject: "Physics", topic: "Physics", type: "numeric",
    text: "A particle executes SHM with amplitude 5 cm and angular frequency 4 rad/s. Find its maximum speed in cm/s.",
    options: [], correctIndex: -1, numericAnswer: 20,
    explanation: "v_max = ωA = 4 × 5 = 20 cm/s.",
  },
  {
    id: "hp2-q22", subject: "Physics", topic: "Physics", type: "numeric",
    text: "A body is projected vertically upward with speed 30 m/s. Take g = 10 m/s². Find the maximum height in metres.",
    options: [], correctIndex: -1, numericAnswer: 45,
    explanation: "H = u²/(2g) = 900/20 = 45 m.",
  },
  {
    id: "hp2-q23", subject: "Physics", topic: "Physics", type: "numeric",
    text: "A 10 μF capacitor is charged to 100 V. Its stored energy, expressed in mJ, is:",
    options: [], correctIndex: -1, numericAnswer: 50,
    explanation: "U = ½CV² = 0.5 × 10 × 10⁻⁶ × 10⁴ = 0.05 J = 50 mJ.",
  },
  {
    id: "hp2-q24", subject: "Physics", topic: "Physics", type: "numeric",
    text: "A 2 kg block moving at 6 m/s collides and sticks to a 1 kg block at rest. Find the common speed in m/s.",
    options: [], correctIndex: -1, numericAnswer: 4,
    explanation: "Momentum conservation: 2 × 6 = 3v, so v = 4 m/s.",
  },
  {
    id: "hp2-q25", subject: "Physics", topic: "Physics", type: "numeric",
    text: "An electron is accelerated through a potential difference of 100 V. Using e = 1.6 × 10⁻¹⁹ C, its kinetic energy in eV is numerically:",
    options: [], correctIndex: -1, numericAnswer: 100,
    explanation: "An electron gaining energy through a potential difference of 100 V gains 100 eV.",
  },

  // ---------------- CHEMISTRY — Section A (MCQ, Q26–45) ----------------
  {
    id: "hp2-q26", subject: "Chemistry", topic: "Chemistry", text: "Which carbocation is most stabilized by hyperconjugation?",
    options: ["CH3+", "CH3CH2+", "(CH3)2CH+", "(CH3)3C+"], correctIndex: 3,
    explanation: "More alkyl groups provide more hyperconjugative structures, so the tert-butyl carbocation is the most stabilized of these.",
  },
  {
    id: "hp2-q27", subject: "Chemistry", topic: "Chemistry", text: "The conjugate base of H2PO4⁻ is:",
    options: ["H3PO4", "HPO4²−", "PO4³−", "OH−"], correctIndex: 1,
    explanation: "Removal of one proton from H2PO4⁻ gives HPO4²−.",
  },
  {
    id: "hp2-q28", subject: "Chemistry", topic: "Chemistry", text: "The number of atoms in one face-centred cubic unit cell effectively belonging to the unit cell is:",
    options: ["1", "2", "4", "6"], correctIndex: 2,
    explanation: "The 8 corners contribute 1 atom and the 6 faces contribute 3 atoms, for a total of 4.",
  },
  {
    id: "hp2-q29", subject: "Chemistry", topic: "Chemistry", text: "For a reaction with rate law r = k[A]²[B], if [A] is doubled and [B] is halved, the rate changes by:",
    options: ["2 times", "4 times", "8 times", "unchanged"], correctIndex: 0,
    explanation: "Rate factor = 2² × ½ = 2.",
  },
  {
    id: "hp2-q30", subject: "Chemistry", topic: "Chemistry", text: "10 g of CaCO3 (M = 100 g mol⁻¹) is heated completely. The volume of CO2 at STP is approximately:",
    options: ["1.12 L", "2.24 L", "4.48 L", "22.4 L"], correctIndex: 1,
    explanation: "n(CaCO3) = 0.1 mol, giving 0.1 mol CO2. At STP, V = 2.24 L.",
  },
  {
    id: "hp2-q31", subject: "Chemistry", topic: "Chemistry", text: "Which oxide is amphoteric?",
    options: ["Na2O", "MgO", "Al2O3", "SO3"], correctIndex: 2,
    explanation: "Al2O3 reacts with both acids and strong bases.",
  },
  {
    id: "hp2-q32", subject: "Chemistry", topic: "Chemistry", text: "At equilibrium, increasing pressure for N2(g) + 3H2(g) ⇌ 2NH3(g) shifts equilibrium:",
    options: ["left", "right", "no change", "first left then right"], correctIndex: 1,
    explanation: "Pressure favours the side with fewer gas moles: 2 versus 4.",
  },
  {
    id: "hp2-q33", subject: "Chemistry", topic: "Chemistry", text: "The oxidation state of chromium in Cr2O7²− is:",
    options: ["+3", "+4", "+6", "+7"], correctIndex: 2,
    explanation: "2x + 7(−2) = −2 gives 2x = 12, so x = +6.",
  },
  {
    id: "hp2-q34", subject: "Chemistry", topic: "Chemistry", text: "Which reagent converts a primary alcohol to an aldehyde without significant over-oxidation?",
    options: ["PCC", "KMnO4/H+", "K2Cr2O7/H+ (excess)", "NaBH4"], correctIndex: 0,
    explanation: "PCC oxidizes primary alcohols selectively to aldehydes under anhydrous conditions.",
  },
  {
    id: "hp2-q35", subject: "Chemistry", topic: "Chemistry", text: "Which complex is expected to be diamagnetic?",
    options: ["[FeF6]3−", "[Fe(CN)6]4−", "[CoF6]3−", "[NiCl4]2−"], correctIndex: 1,
    explanation: "[Fe(CN)6]4− has Fe2+, d6 with strong-field CN−, giving low-spin t2g6 with all electrons paired.",
  },
  {
    id: "hp2-q36", subject: "Chemistry", topic: "Chemistry", text: "Which compound gives a positive iodoform test?",
    options: ["Methanol", "Ethanol", "Propanal", "Benzaldehyde"], correctIndex: 1,
    explanation: "Ethanol is oxidized to ethanal, which contains the CH3CO− unit required for the iodoform reaction.",
  },
  {
    id: "hp2-q37", subject: "Chemistry", topic: "Chemistry", text: "The standard cell potential for a galvanic cell is positive when:",
    options: ["ΔG° > 0", "E°cell < 0", "ΔG° < 0", "K < 1 necessarily"], correctIndex: 2,
    explanation: "ΔG° = −nFE°cell. A spontaneous standard reaction has ΔG° < 0 and E°cell > 0.",
  },
  {
    id: "hp2-q38", subject: "Chemistry", topic: "Chemistry", text: "Which species has the largest bond order according to molecular orbital theory?",
    options: ["O2", "O2+", "O2−", "O2²−"], correctIndex: 1,
    explanation: "Removing an electron from an antibonding π* orbital raises the bond order: O2 = 2, O2+ = 2.5, O2− = 1.5, O2²− = 1.",
  },
  {
    id: "hp2-q39", subject: "Chemistry", topic: "Chemistry", text: "The major product of propene with HBr in the absence of peroxide is:",
    options: ["1-bromopropane", "2-bromopropane", "propanol", "allyl bromide"], correctIndex: 1,
    explanation: "Electrophilic addition follows Markovnikov orientation, giving 2-bromopropane.",
  },
  {
    id: "hp2-q40", subject: "Chemistry", topic: "Chemistry", text: "Among BF3, NH3, H2O and CH4, the molecule with zero dipole moment is:",
    options: ["BF3", "NH3", "H2O", "CH4"], correctIndex: 0,
    explanation: "BF3 is trigonal planar and symmetric, so the bond dipoles cancel.",
  },
  {
    id: "hp2-q41", subject: "Chemistry", topic: "Chemistry", text: "Aniline is less basic than cyclohexylamine mainly because in aniline:",
    options: ["N is sp3", "lone pair is delocalized into benzene ring", "N is positively charged", "no lone pair exists"], correctIndex: 1,
    explanation: "The nitrogen lone pair participates in resonance with the aromatic ring, reducing its availability for protonation.",
  },
  {
    id: "hp2-q42", subject: "Chemistry", topic: "Chemistry", text: "A buffer contains equal concentrations of CH3COOH and CH3COONa. If Ka = 1.8 × 10⁻⁵, the pH is closest to:",
    options: ["4.74", "5.74", "2.74", "9.26"], correctIndex: 0,
    explanation: "Henderson-Hasselbalch: pH = pKa + log 1 = pKa = −log(1.8 × 10⁻⁵) = 4.74.",
  },
  {
    id: "hp2-q43", subject: "Chemistry", topic: "Chemistry", text: "Which polymer is formed by condensation polymerization?",
    options: ["Polyethene", "PVC", "Teflon", "Nylon-6,6"], correctIndex: 3,
    explanation: "Nylon-6,6 forms from a diamine and a diacid with elimination of small molecules, so it is a condensation polymer.",
  },
  {
    id: "hp2-q44", subject: "Chemistry", topic: "Chemistry", text: "For an ideal solution obeying Raoult's law, the partial vapour pressure of component A is:",
    options: ["xA P°A", "P°A / xA", "xB P°A", "P°A + P°B"], correctIndex: 0,
    explanation: "Raoult's law: p_A = x_A P°_A.",
  },
  {
    id: "hp2-q45", subject: "Chemistry", topic: "Chemistry", text: "A first-order reaction has half-life 20 min. The time required for 87.5% completion is:",
    options: ["40 min", "60 min", "80 min", "100 min"], correctIndex: 1,
    explanation: "12.5% remains = 1/8 = (1/2)³, so three half-lives = 60 min.",
  },

  // ---------------- CHEMISTRY — Section B (numerical, Q46–50) ----------------
  {
    id: "hp2-q46", subject: "Chemistry", topic: "Chemistry", type: "numeric",
    text: "How many stereoisomers are possible for a molecule with two independent chiral centres and no meso form?",
    options: [], correctIndex: -1, numericAnswer: 4,
    explanation: "For n = 2 independent centres the maximum is 2ⁿ = 4.",
  },
  {
    id: "hp2-q47", subject: "Chemistry", topic: "Chemistry", type: "numeric",
    text: "How many moles of electrons are required to reduce 1 mol of MnO4⁻ to Mn2+ in acidic medium?",
    options: [], correctIndex: -1, numericAnswer: 5,
    explanation: "Mn(+7) to Mn(+2) requires 5 electrons per Mn.",
  },
  {
    id: "hp2-q48", subject: "Chemistry", topic: "Chemistry", type: "numeric",
    text: "For a first-order reaction, if k = 0.0231 min⁻¹, its half-life in minutes is approximately:",
    options: [], correctIndex: -1, numericAnswer: 30,
    explanation: "t₁/₂ = 0.693/k ≈ 30 min.",
  },
  {
    id: "hp2-q49", subject: "Chemistry", topic: "Chemistry", type: "numeric",
    text: "One mole of an ideal gas expands reversibly and isothermally from 10 L to 20 L at 300 K. Using R = 8.314 J mol⁻¹ K⁻¹, the work in J is approximately 1729. Find the nearest integer.",
    options: [], correctIndex: -1, numericAnswer: 1729,
    explanation: "W = nRT ln(V₂/V₁) = 8.314 × 300 × ln 2 ≈ 1728.9 J.",
  },
  {
    id: "hp2-q50", subject: "Chemistry", topic: "Chemistry", type: "numeric",
    text: "The pH of 0.001 M HCl at 25°C is:",
    options: [], correctIndex: -1, numericAnswer: 3,
    explanation: "A strong acid fully dissociates, so [H⁺] = 10⁻³ M.",
  },

  // ---------------- MATHEMATICS — Section A (MCQ, Q51–70) ----------------
  {
    id: "hp2-q51", subject: "Mathematics", topic: "Mathematics", text: "The minimum value of x + 1/x for x > 0 is:",
    options: ["0", "1", "2", "4"], correctIndex: 2,
    explanation: "By AM-GM, x + 1/x ≥ 2, with equality at x = 1.",
  },
  {
    id: "hp2-q52", subject: "Mathematics", topic: "Mathematics", text: "The general solution of dy/dx = 2x(1 + y) is:",
    options: ["1 + y = Ce^(x²)", "1 + y = Ce^(2x)", "y = Ce^(x²)", "y + 1 = Cx²"], correctIndex: 0,
    explanation: "dy/(1 + y) = 2x dx, so ln|1 + y| = x² + C, giving 1 + y = Ce^(x²).",
  },
  {
    id: "hp2-q53", subject: "Mathematics", topic: "Mathematics", text: "The distance between the parallel lines 3x + 4y − 7 = 0 and 3x + 4y + 8 = 0 is:",
    options: ["1", "2", "3", "5"], correctIndex: 2,
    explanation: "Distance = |8 − (−7)|/√(9 + 16) = 15/5 = 3.",
  },
  {
    id: "hp2-q54", subject: "Mathematics", topic: "Mathematics", text: "The sum to infinity of 3 + 1 + 1/3 + … is:",
    options: ["9/2", "4", "3", "6"], correctIndex: 0,
    explanation: "Geometric series with a = 3 and r = 1/3: S = 3/(1 − 1/3) = 9/2.",
  },
  {
    id: "hp2-q55", subject: "Mathematics", topic: "Mathematics", text: "∫₀¹ x/(1 + x²) dx equals:",
    options: ["ln 2", "(1/2) ln 2", "1/2", "1"], correctIndex: 1,
    explanation: "Let u = 1 + x², so du = 2x dx. The integral is ½ ln(1 + x²) evaluated from 0 to 1 = (1/2) ln 2.",
  },
  {
    id: "hp2-q56", subject: "Mathematics", topic: "Mathematics", text: "lim(x→0) [sin x − x cos x]/x³ equals:",
    options: ["1/3", "1/2", "1", "0"], correctIndex: 0,
    explanation: "Using expansions, sin x − x cos x = (x − x³/6) − (x − x³/2) + … = x³/3 + …, so the limit is 1/3.",
  },
  {
    id: "hp2-q57", subject: "Mathematics", topic: "Mathematics", text: "The equation of the tangent to x² + y² = 25 at (3, 4) is:",
    options: ["3x + 4y = 25", "4x + 3y = 25", "3x − 4y = 25", "x + y = 7"], correctIndex: 0,
    explanation: "For x² + y² = a² the tangent at (x₁, y₁) is xx₁ + yy₁ = a², giving 3x + 4y = 25.",
  },
  {
    id: "hp2-q58", subject: "Mathematics", topic: "Mathematics", text: "If the roots of x² − 6x + k = 0 are in the ratio 1:2, then k equals:",
    options: ["6", "8", "9", "12"], correctIndex: 1,
    explanation: "The roots are a and 2a, so 3a = 6 and a = 2. Their product is 2a² = 8, hence k = 8.",
  },
  {
    id: "hp2-q59", subject: "Mathematics", topic: "Mathematics", text: "How many 5-digit numbers can be formed from digits 0,1,2,3,4,5 without repetition and divisible by 5?",
    options: ["180", "216", "240", "300"], correctIndex: 1,
    explanation: "The last digit must be 0 or 5. If it is 0, the other four positions give 5P4 = 120. If it is 5, the leading digit has 4 choices (1–4) and the remaining four positions give 4P4 = 24, so 96. Total 216.",
  },
  {
    id: "hp2-q60", subject: "Mathematics", topic: "Mathematics", text: "If z satisfies |z − 1| = |z + 1|, then z lies on:",
    options: ["x-axis", "y-axis", "circle |z| = 1", "line y = x"], correctIndex: 1,
    explanation: "Equidistance from (1, 0) and (−1, 0) gives x = 0, the imaginary axis.",
  },
  {
    id: "hp2-q61", subject: "Mathematics", topic: "Mathematics", text: "The angle between vectors a = (1, 1, 0) and b = (1, 0, 1) is:",
    options: ["cos⁻¹(1/2)", "cos⁻¹(1/3)", "π/4", "π/3"], correctIndex: 0,
    explanation: "The dot product is 1 and each magnitude is √2, so cos θ = 1/2.",
  },
  {
    id: "hp2-q62", subject: "Mathematics", topic: "Mathematics", text: "The area enclosed between y = x and y = x² from x = 0 to 1 is:",
    options: ["1/3", "1/6", "1/2", "2/3"], correctIndex: 1,
    explanation: "Area = ∫₀¹ (x − x²) dx = 1/2 − 1/3 = 1/6.",
  },
  {
    id: "hp2-q63", subject: "Mathematics", topic: "Mathematics", text: "For f(x) = x³ − 3x, the local maximum value is:",
    options: ["−2", "0", "2", "3"], correctIndex: 2,
    explanation: "f′ = 3(x² − 1) gives critical points at ±1, and f″ = 6x, so x = −1 is a maximum with f(−1) = 2.",
  },
  {
    id: "hp2-q64", subject: "Mathematics", topic: "Mathematics", text: "The coefficient of x³ in (1 + x)⁸ is:",
    options: ["56", "64", "70", "84"], correctIndex: 0,
    explanation: "The coefficient is C(8, 3) = 56.",
  },
  {
    id: "hp2-q65", subject: "Mathematics", topic: "Mathematics", text: "The shortest distance between the skew lines r = (1,0,0) + λ(1,1,0) and r = (0,1,1) + μ(1,0,1) is:",
    options: ["1/√3", "1", "√3", "3"], correctIndex: 2,
    explanation: "Distance = |(b − a)·(d₁ × d₂)| / |d₁ × d₂|. Here b − a = (−1, 1, 1) and d₁ × d₂ = (1, −1, −1), whose magnitude is √3, with a dot product of −3. So the distance is 3/√3 = √3.",
  },
  {
    id: "hp2-q66", subject: "Mathematics", topic: "Mathematics", text: "A fair coin is tossed 6 times. Probability of exactly 3 heads is:",
    options: ["5/16", "15/64", "5/32", "1/2"], correctIndex: 0,
    explanation: "P = C(6,3)/2⁶ = 20/64 = 5/16.",
  },
  {
    id: "hp2-q67", subject: "Mathematics", topic: "Mathematics", text: "The number of solutions of tan x = √3 in 0 ≤ x ≤ 2π is:",
    options: ["1", "2", "3", "4"], correctIndex: 1,
    explanation: "x = π/3 + nπ, which in [0, 2π] gives x = π/3 and 4π/3 — two solutions.",
  },
  {
    id: "hp2-q68", subject: "Mathematics", topic: "Mathematics", text: "The number of real roots of x⁴ − 5x² + 4 = 0 is:",
    options: ["2", "3", "4", "0"], correctIndex: 2,
    explanation: "Let y = x²: y² − 5y + 4 = (y − 1)(y − 4), so x = ±1, ±2 — four real roots.",
  },
  {
    id: "hp2-q69", subject: "Mathematics", topic: "Mathematics", text: "If A is a 2×2 matrix with det A = −2, then det(3A) equals:",
    options: ["−6", "−18", "6", "18"], correctIndex: 1,
    explanation: "For a 2×2 matrix det(3A) = 3² det A = 9(−2) = −18.",
  },
  {
    id: "hp2-q70", subject: "Mathematics", topic: "Mathematics", text: "The principal value of sin⁻¹(sin 5π/6) is:",
    options: ["5π/6", "π/6", "−π/6", "2π/3"], correctIndex: 1,
    explanation: "The principal range of sin⁻¹ is [−π/2, π/2]. Since sin(5π/6) = 1/2, the answer is π/6.",
  },

  // ---------------- MATHEMATICS — Section B (numerical, Q71–75) ----------------
  {
    id: "hp2-q71", subject: "Mathematics", topic: "Mathematics", type: "numeric",
    text: "The number of diagonals in a polygon is 35. Find the number of sides.",
    options: [], correctIndex: -1, numericAnswer: 10,
    explanation: "n(n − 3)/2 = 35 gives n² − 3n − 70 = 0, so n = 10.",
  },
  {
    id: "hp2-q72", subject: "Mathematics", topic: "Mathematics", type: "numeric",
    text: "The sum of the first 20 positive integers that are divisible by 3 is:",
    options: [], correctIndex: -1, numericAnswer: 630,
    explanation: "3(1 + 2 + … + 20) = 3 × 210 = 630.",
  },
  {
    id: "hp2-q73", subject: "Mathematics", topic: "Mathematics", type: "numeric",
    text: "If ∫₀^a 2x dx = 9 for a > 0, find a.",
    options: [], correctIndex: -1, numericAnswer: 3,
    explanation: "∫₀^a 2x dx = a² = 9, hence a = 3.",
  },
  {
    id: "hp2-q74", subject: "Mathematics", topic: "Mathematics", type: "numeric",
    text: "The number of real solutions of |x − 1| + |x + 1| = 4 is:",
    options: [], correctIndex: -1, numericAnswer: 2,
    explanation: "For |x| ≥ 1 the expression is 2|x| = 4, so x = ±2; for |x| < 1 it equals 2, which gives no solutions.",
  },
  {
    id: "hp2-q75", subject: "Mathematics", topic: "Mathematics", type: "numeric",
    text: "If the determinant |1 1 1; 1 2 3; 1 3 6| equals N, find N.",
    options: [], correctIndex: -1, numericAnswer: 1,
    explanation: "Expanding: 1(12 − 9) − 1(6 − 3) + 1(3 − 2) = 3 − 3 + 1 = 1.",
  },
];

QUESTION_BANK.push(...PAPER_2_QUESTIONS);

export const MOCK_TESTS: MockTest[] = [
  {
    id: "jee-main-hardcore-paper-2-2026",
    slug: "jee-main-hardcore-mock-paper-2-2026",
    title: "Hardcore JEE Mock Test — Paper 2",
    exam: "JEE Main",
    examSlug: "jee-main",
    subject: "Full Syllabus",
    difficulty: "Hard",
    questionCount: PAPER_2_QUESTIONS.length,
    durationMins: 180,
    description:
      "Full-length JEE Main 2026 pattern paper: 75 questions across Physics, Chemistry and Mathematics — 20 MCQs plus 5 numerical-value questions per subject. Advanced conceptual difficulty, timed 3 hours, with detailed solutions.",
    topics: ["Physics", "Chemistry", "Mathematics"],
    attempts: 0,
    marksPerCorrect: 4,
    marksPerWrong: 1,
    questionIds: PAPER_2_QUESTIONS.map((q) => q.id),
  },
];

export const MOCK_EXAM_GROUPS: { exam: string; slug: string }[] = [];

export function getMockTest(slug: string): MockTest | undefined {
  return MOCK_TESTS.find((t) => t.slug === slug);
}

export function isNumericQuestion(q: MockTestQuestion): boolean {
  return q.type === "numeric";
}

/** Marks for a test, falling back to the +3 / −1 default it has always used. */
export function resolveMarks(test: MockTest): { correct: number; wrong: number } {
  return { correct: test.marksPerCorrect ?? 3, wrong: test.marksPerWrong ?? 1 };
}

export function getTestQuestions(test: MockTest): MockTestQuestion[] {
  if (test.questionIds?.length) {
    const ordered = test.questionIds
      .map((id) => QUESTION_BANK.find((q) => q.id === id))
      .filter((q): q is QuestionBankItem => q !== undefined);
    if (ordered.length) return ordered;
  }

  const subjects = test.subject === "Full Syllabus"
    ? ["Physics", "Chemistry", "Mathematics"]
    : test.subject === "Reasoning + Quant"
      ? ["Reasoning"]
      : [test.subject];

  const pools = subjects.flatMap((s) => bySubject(s));
  const picked = pickDeterministic(seedId(test.slug, test.subject), pools, test.questionCount);
  return picked.map((q, i) => ({
    id: `${test.slug}-q${i + 1}`,
    text: q.text,
    type: q.type,
    options: q.options,
    correctIndex: q.correctIndex,
    numericAnswer: q.numericAnswer,
    explanation: q.explanation,
    topic: q.topic,
    subject: q.subject,
  }));
}

/**
 * Removed on purpose.
 *
 * This returned `pct * 0.92 + 8`, capped just under 100 — a formula that turned
 * any raw score into a confident-looking percentile. A percentile is a claim
 * about where you rank against every other test-taker, and there is no cohort
 * data in this project to support one, so every number it produced was invented.
 * Callers should show the score and the percentage obtained, which are
 * derivable from the test itself, or nothing.
 */
