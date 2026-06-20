import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronRight, Dumbbell, Edit2, Loader2, Save, ShieldCheck, UtensilsCrossed, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { JimmiWordmark } from "@/components/JimmiWordmark";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

type EliteUser = {
  id: number;
  name: string | null;
  email: string | null;
  tier: string;
  createdAt: Date;
  lastSignedIn: Date;
  hasProfile: boolean;
  firstName: string | null;
  fitnessGoals: string | null;
  fitnessLevel: string | null;
  activityLevel: string | null;
  healthComplications: string | null;
  dietRestrictions: string | null;
  foodAllergies: string | null;
  weight: number | null;
  targetWeight: number | null;
  height: string | null;
  birthday: string | null;
  hasProgram: boolean;
  programTitle: string | null;
  programUpdatedAt: Date | null;
  macroCalories: number;
  macroProtein: number;
  macroCarbs: number;
  macroFat: number;
  coachMacroCalories: number | null;
  coachMacroProtein: number | null;
  coachMacroCarbs: number | null;
  coachMacroFat: number | null;
  coachNotes: string | null;
};

// ─── Macro Override Form ──────────────────────────────────────────────────────

function MacroOverrideForm({ user, onClose }: { user: EliteUser; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [calories, setCalories] = useState<string>(String(user.coachMacroCalories ?? user.macroCalories ?? ""));
  const [protein, setProtein] = useState<string>(String(user.coachMacroProtein ?? user.macroProtein ?? ""));
  const [carbs, setCarbs] = useState<string>(String(user.coachMacroCarbs ?? user.macroCarbs ?? ""));
  const [fat, setFat] = useState<string>(String(user.coachMacroFat ?? user.macroFat ?? ""));
  const [notes, setNotes] = useState<string>(user.coachNotes ?? "");
  const [saved, setSaved] = useState(false);

  const override = trpc.coach.overrideMacros.useMutation({
    onSuccess: async () => {
      await utils.coach.listEliteUsers.invalidate();
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    },
  });

  const handleSave = () => {
    override.mutate({
      userId: user.id,
      calories: calories ? parseInt(calories, 10) : null,
      protein: protein ? parseInt(protein, 10) : null,
      carbs: carbs ? parseInt(carbs, 10) : null,
      fat: fat ? parseInt(fat, 10) : null,
      notes: notes || null,
    });
  };

  const handleReset = () => {
    override.mutate({ userId: user.id, calories: null, protein: null, carbs: null, fat: null, notes: null });
  };

  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-card p-6" data-coach-macro-override-form="true">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-medium">Override macros — {user.firstName ?? user.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
      <p className="text-xs text-muted-foreground mb-5">JIMMI-calculated targets are shown as placeholders. Leave a field blank to keep the original value.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        {[
          { label: "Calories", value: calories, set: setCalories, placeholder: String(user.macroCalories) },
          { label: "Protein (g)", value: protein, set: setProtein, placeholder: String(user.macroProtein) },
          { label: "Carbs (g)", value: carbs, set: setCarbs, placeholder: String(user.macroCarbs) },
          { label: "Fat (g)", value: fat, set: setFat, placeholder: String(user.macroFat) },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label}>
            <label className="block text-xs text-muted-foreground mb-1">{label}</label>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
      </div>
      <div className="mb-5">
        <label className="block text-xs text-muted-foreground mb-1">Coach notes (visible to you only)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Increased protein target due to muscle-building phase..."
          className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={override.isPending || saved} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-1">
          <Save className="mr-2 size-4" /> {saved ? "Saved!" : override.isPending ? "Saving..." : "Save override"}
        </Button>
        <Button onClick={handleReset} variant="outline" disabled={override.isPending} className="rounded-full border-white/10 bg-transparent text-muted-foreground hover:bg-white/5">
          Reset to JIMMI
        </Button>
      </div>
    </div>
  );
}

// ─── Program Override Form ────────────────────────────────────────────────────

function ProgramOverrideForm({ user, onClose }: { user: EliteUser; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(user.programTitle ?? "");
  const [planJson, setPlanJson] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const override = trpc.coach.overrideProgram.useMutation({
    onSuccess: async () => {
      await utils.coach.listEliteUsers.invalidate();
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    },
    onError: (e) => setError(e.message),
  });

  const handleSave = () => {
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(planJson); } catch { setError("Plan JSON is not valid JSON. Please check the format."); return; }
    override.mutate({ userId: user.id, title: title.trim(), planJson: JSON.stringify(parsed) });
  };

  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-card p-6" data-coach-program-override-form="true">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-medium">Override program — {user.firstName ?? user.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
      <p className="text-xs text-muted-foreground mb-5">This replaces the user's current saved training program. The user will see the new program immediately on their My Program page.</p>
      <div className="mb-4">
        <label className="block text-xs text-muted-foreground mb-1">Program title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 8-Week Strength Foundation"
          className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="mb-5">
        <label className="block text-xs text-muted-foreground mb-1">Program plan (JSON)</label>
        <textarea
          value={planJson}
          onChange={(e) => setPlanJson(e.target.value)}
          rows={8}
          placeholder={'{\n  "weeks": [...]\n}'}
          className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>
      {error ? <p className="mb-4 text-xs text-red-400">{error}</p> : null}
      <Button onClick={handleSave} disabled={override.isPending || saved} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 w-full">
        <Save className="mr-2 size-4" /> {saved ? "Saved!" : override.isPending ? "Saving..." : "Replace program"}
      </Button>
    </div>
  );
}

// ─── Calorie Balance Chart ────────────────────────────────────────────────────

function CalorieBalanceChart({ userId }: { userId: number }) {
  const { data, isLoading } = trpc.coach.getUserCalorieBalance.useQuery({ userId });

  if (isLoading) return <div className="flex h-40 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!data?.balance?.length) return <p className="text-xs text-muted-foreground py-4">No calorie data available yet.</p>;

  const chartData = data.balance.map((d) => ({
    date: d.logDate.slice(5),
    in: d.caloriesIn,
    out: d.totalCaloriesOut,
    net: d.netCalories,
  }));

  return (
    <div className="mt-4" data-coach-calorie-chart="7-day">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.75rem", fontSize: "12px" }}
            labelStyle={{ color: "#fafafa" }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
          <Bar dataKey="in" name="Calories in" fill="#E8FF00" radius={[4, 4, 0, 0]} opacity={0.85} />
          <Bar dataKey="out" name="Calories out" fill="#444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted-foreground">Yellow = calories consumed · Grey = calories burned (wearable)</p>
    </div>
  );
}

// ─── Food Log Table ───────────────────────────────────────────────────────────

function FoodLogTable({ userId }: { userId: number }) {
  const { data, isLoading } = trpc.coach.getUserFoodLogs.useQuery({ userId });

  if (isLoading) return <div className="flex h-20 items-center justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  if (!data?.entries?.length) return <p className="text-xs text-muted-foreground py-3">No food log entries in the last 14 days.</p>;

  return (
    <div className="mt-3 overflow-x-auto" data-coach-food-log-table="true">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-normal">Date</th>
            <th className="pb-2 pr-3 font-normal">Meal</th>
            <th className="pb-2 pr-3 font-normal">Food</th>
            <th className="pb-2 pr-3 font-normal text-right">kcal</th>
            <th className="pb-2 pr-3 font-normal text-right">P</th>
            <th className="pb-2 pr-3 font-normal text-right">C</th>
            <th className="pb-2 font-normal text-right">F</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((e) => (
            <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="py-2 pr-3 text-muted-foreground">{e.logDate}</td>
              <td className="py-2 pr-3 capitalize">{e.mealType}</td>
              <td className="py-2 pr-3 max-w-[160px] truncate">{e.foodName}</td>
              <td className="py-2 pr-3 text-right">{e.calories}</td>
              <td className="py-2 pr-3 text-right text-blue-400">{e.protein}g</td>
              <td className="py-2 pr-3 text-right text-amber-400">{e.carbs}g</td>
              <td className="py-2 text-right text-rose-400">{e.fat}g</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Workout Log Table ────────────────────────────────────────────────────────

function WorkoutLogTable({ userId }: { userId: number }) {
  const { data, isLoading } = trpc.coach.getUserWorkoutLogs.useQuery({ userId });

  if (isLoading) return <div className="flex h-20 items-center justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  if (!data?.entries?.length) return <p className="text-xs text-muted-foreground py-3">No workout log entries in the last 30 days.</p>;

  return (
    <div className="mt-3 overflow-x-auto" data-coach-workout-log-table="true">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-normal">Date</th>
            <th className="pb-2 pr-3 font-normal">Exercise</th>
            <th className="pb-2 pr-3 font-normal text-right">Sets</th>
            <th className="pb-2 pr-3 font-normal text-right">Reps</th>
            <th className="pb-2 font-normal text-right">Weight</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((e) => (
            <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="py-2 pr-3 text-muted-foreground">{new Date(e.loggedAt).toLocaleDateString()}</td>
              <td className="py-2 pr-3 max-w-[180px] truncate">{e.exerciseName}</td>
              <td className="py-2 pr-3 text-right">{e.sets}</td>
              <td className="py-2 pr-3 text-right">{e.reps}</td>
              <td className="py-2 text-right">{e.weight > 0 ? `${e.weight} kg` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── User Detail Panel ────────────────────────────────────────────────────────

function UserDetail({ user, onBack }: { user: EliteUser; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "food" | "workouts">("overview");
  const [showMacroForm, setShowMacroForm] = useState(false);
  const [showProgramForm, setShowProgramForm] = useState(false);

  const effectiveMacros = {
    calories: user.coachMacroCalories ?? user.macroCalories,
    protein: user.coachMacroProtein ?? user.macroProtein,
    carbs: user.coachMacroCarbs ?? user.macroCarbs,
    fat: user.coachMacroFat ?? user.macroFat,
  };
  const hasOverride = user.coachMacroCalories !== null;

  return (
    <div data-coach-user-detail="true">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All Elite members
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Elite member</p>
          <h2 className="mt-2 font-display text-3xl font-light tracking-tight">{user.firstName ?? user.name ?? "Unknown"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{user.email ?? "No email"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString()} · Last active {new Date(user.lastSignedIn).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setShowMacroForm(!showMacroForm); setShowProgramForm(false); }} variant="outline" className="rounded-full border-white/10 bg-transparent text-sm hover:bg-white/5" data-coach-override-macros-button="true">
            <Edit2 className="mr-2 size-3.5" /> Macros
          </Button>
          {user.hasProgram ? (
            <Button onClick={() => { setShowProgramForm(!showProgramForm); setShowMacroForm(false); }} variant="outline" className="rounded-full border-white/10 bg-transparent text-sm hover:bg-white/5" data-coach-override-program-button="true">
              <Edit2 className="mr-2 size-3.5" /> Program
            </Button>
          ) : null}
        </div>
      </div>

      {showMacroForm ? <div className="mb-6"><MacroOverrideForm user={user} onClose={() => setShowMacroForm(false)} /></div> : null}
      {showProgramForm ? <div className="mb-6"><ProgramOverrideForm user={user} onClose={() => setShowProgramForm(false)} /></div> : null}

      {/* Profile snapshot */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-coach-profile-snapshot="true">
        {[
          { label: "Fitness goal", value: user.fitnessGoals },
          { label: "Fitness level", value: user.fitnessLevel },
          { label: "Activity level", value: user.activityLevel },
          { label: "Current weight", value: user.weight ? `${user.weight} kg` : null },
          { label: "Target weight", value: user.targetWeight ? `${user.targetWeight} kg` : null },
          { label: "Height", value: user.height },
          { label: "Health conditions", value: user.healthComplications || "None" },
          { label: "Dietary restrictions", value: user.dietRestrictions || "None" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-card/50 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-medium truncate">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* Macro targets */}
      <div className="mb-6 rounded-[1.4rem] border border-white/10 bg-card p-5" data-coach-macro-targets="true">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Daily macro targets</h3>
          {hasOverride ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Coach override active</span> : <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">JIMMI-calculated</span>}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Calories", value: effectiveMacros.calories, unit: "kcal", color: "text-foreground" },
            { label: "Protein", value: effectiveMacros.protein, unit: "g", color: "text-blue-400" },
            { label: "Carbs", value: effectiveMacros.carbs, unit: "g", color: "text-amber-400" },
            { label: "Fat", value: effectiveMacros.fat, unit: "g", color: "text-rose-400" },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-light ${color}`}>{value}<span className="ml-0.5 text-xs text-muted-foreground">{unit}</span></p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        {user.coachNotes ? <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-xs text-muted-foreground"><span className="text-primary">Coach note:</span> {user.coachNotes}</p> : null}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-full border border-white/10 bg-card/50 p-1 w-fit" data-coach-detail-tabs="true">
        {(["overview", "food", "workouts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${activeTab === tab ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "overview" ? "Calorie balance" : tab === "food" ? "Food log" : "Workouts"}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? <CalorieBalanceChart userId={user.id} /> : null}
      {activeTab === "food" ? <FoodLogTable userId={user.id} /> : null}
      {activeTab === "workouts" ? <WorkoutLogTable userId={user.id} /> : null}
    </div>
  );
}

// ─── User List ────────────────────────────────────────────────────────────────

function UserList({ users, onSelect }: { users: EliteUser[]; onSelect: (u: EliteUser) => void }) {
  if (!users.length) {
    return (
      <div className="rounded-[1.4rem] border border-white/10 bg-card p-8 text-center" data-coach-empty-state="no-elite-users">
        <p className="text-sm text-muted-foreground">No Elite members yet.</p>
        <p className="mt-2 text-xs text-muted-foreground">Assign Elite tier to users from the Admin Management page.</p>
        <Button asChild variant="outline" className="mt-4 rounded-full border-white/10 bg-transparent text-sm hover:bg-white/5">
          <Link href="/admin-management">Open Admin Management</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-coach-user-list="elite-members">
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => onSelect(u)}
          className="w-full rounded-[1.2rem] border border-white/10 bg-card p-4 text-left hover:border-white/20 hover:bg-white/[0.03] transition-colors"
          data-coach-user-row={u.id}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="font-medium truncate">{u.firstName ?? u.name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email ?? "No email"}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <div className="hidden sm:flex gap-2 text-xs text-muted-foreground">
                {u.hasProfile ? <span className="flex items-center gap-1"><UtensilsCrossed className="size-3" /> Profile</span> : null}
                {u.hasProgram ? <span className="flex items-center gap-1"><Dumbbell className="size-3" /> Program</span> : null}
                {u.coachMacroCalories !== null ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Override</span> : null}
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachPanel() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [selectedUser, setSelectedUser] = useState<EliteUser | null>(null);

  const isAdmin = user?.role === "admin";
  const eliteUsersQuery = trpc.coach.listEliteUsers.useQuery(undefined, { enabled: isAdmin });

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="container flex min-h-screen items-center justify-center">
          <div className="max-w-md rounded-[2rem] border border-white/10 bg-card p-8 text-center">
            <ShieldCheck className="mx-auto size-10 text-muted-foreground mb-4" />
            <h1 className="font-display text-2xl font-light">Coach access required</h1>
            <p className="mt-3 text-sm text-muted-foreground">This panel is restricted to admin coaches only.</p>
            <Button asChild className="mt-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/chat">Back to JIMMI</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  const eliteUsers = (eliteUsersQuery.data?.users ?? []) as EliteUser[];

  return (
    <main className="min-h-screen bg-background text-foreground" data-coach-panel-page="true">
      <section className="container px-6 py-8 sm:px-8 md:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <JimmiWordmark variant="member" />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/admin-management" className="text-muted-foreground hover:text-foreground transition-colors">Admin tools</Link>
            <Link href="/chat" className="text-muted-foreground hover:text-foreground transition-colors">Chat</Link>
          </nav>
        </header>

        <div className="mx-auto mt-10 max-w-4xl sm:mt-12">
          {!selectedUser ? (
            <>
              <div className="border-b border-white/10 pb-8 mb-8">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">Elite coaching</p>
                <h1 className="mt-4 font-display text-4xl font-light leading-tight tracking-tight md:text-6xl">Coach panel</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                  View calorie balance, food logs, workout history, and override macro targets or training programs for Elite members.
                </p>
              </div>
              {eliteUsersQuery.isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <UserList users={eliteUsers} onSelect={setSelectedUser} />
              )}
            </>
          ) : (
            <UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} />
          )}
        </div>
      </section>
    </main>
  );
}
