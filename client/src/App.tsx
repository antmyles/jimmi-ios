import { Route, Switch } from "wouter";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Home from "@/pages/Home";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import Onboarding from "@/pages/Onboarding";
import Chat from "@/pages/Chat";
import VideoTransition from "@/pages/VideoTransition";
import OAuthCallback from "@/pages/OAuthCallback";
import GoogleComplete from "@/pages/GoogleComplete";
import SignUp from "@/pages/SignUp";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import MyProgram from "@/pages/MyProgram";
import FoodLog from "@/pages/FoodLog";
import AccountSettings from "@/pages/AccountSettings";
import Integrations from "@/pages/Integrations";
import AdminManagement from "@/pages/AdminManagement";
import CoachPanel from "@/pages/CoachPanel";
import SubscriptionStatus from "@/pages/SubscriptionStatus";
import Pricing from "@/pages/Pricing";
import BillingHistory from "@/pages/BillingHistory";
import { Toaster } from "@/components/ui/sonner";

function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container flex min-h-screen items-center py-16">
        <div className="max-w-xl rounded-[2rem] border border-white/10 bg-card p-8">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">404</p>
          <h1 className="mt-4 font-display text-5xl font-light tracking-tight">Route not found</h1>
          <p className="mt-4 text-muted-foreground">The clean rebuild is being restored module by module.</p>
          <a className="mt-8 inline-flex rounded-full border border-white/10 px-6 py-3 text-sm font-medium hover:border-primary hover:text-primary" href="/">
            Back home
          </a>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/signup" component={SignUp} />
        <Route path="/login" component={Login} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/auth/callback" component={OAuthCallback} />
        <Route path="/auth/google-complete" component={GoogleComplete} />
        <Route path="/chat-transition" component={VideoTransition} />
        <Route path="/transition" component={VideoTransition} />
        <Route path="/chat" component={Chat} />
        <Route path="/profile" component={Profile} />
        <Route path="/my-program" component={MyProgram} />
        <Route path="/training-plan" component={MyProgram} />
        <Route path="/meal-plan" component={MyProgram} />
        <Route path="/food-log" component={FoodLog} />
        <Route path="/account-settings" component={AccountSettings} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/integrations/:provider" component={Integrations} />
        <Route path="/admin-management" component={AdminManagement} />
        <Route path="/management" component={AdminManagement} />
        <Route path="/beta-reset" component={AdminManagement} />
        <Route path="/coach-panel" component={CoachPanel} />
        <Route path="/subscription" component={SubscriptionStatus} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/billing" component={BillingHistory} />
        <Route component={NotFound} />
      </Switch>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}
