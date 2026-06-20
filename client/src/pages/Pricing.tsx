import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with AI-powered fitness coaching",
    cta: "Get Started",
    highlighted: false,
    limitations: [
      "Limited to 5 AI coaching sessions per week",
      "Basic workout plans only (no periodization)",
      "Form feedback limited to 3 videos per week",
      "No meal planning or nutrition tracking",
    ],
    features: [
      { name: "AI Fitness Coach", included: true },
      { name: "Gemini 2.0 Flash AI", included: true },
      { name: "Basic workout plans", included: true },
      { name: "Form feedback on videos", included: true },
      { name: "Claude AI coaching", included: false },
      { name: "Advanced program customization", included: false },
      { name: "Priority support", included: false },
      { name: "Nutrition optimization", included: false },
    ],
  },
  {
    name: "Core+",
    price: "$15.99",
    period: "/month",
    description: "Advanced AI coaching with Gemini 2.0 Flash, unlimited coaching sessions, full meal planning, and nutrition tracking.",
    cta: "Upgrade to Core+",
    highlighted: false,
    features: [
      { name: "AI Fitness Coach", included: true },
      { name: "Gemini 2.0 Flash AI", included: true },
      { name: "Basic workout plans", included: true },
      { name: "Form feedback on videos", included: true },
      { name: "Claude AI coaching", included: false },
      { name: "Advanced program customization", included: false },
      { name: "Priority support", included: false },
      { name: "Nutrition optimization", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$25.99",
    period: "/month",
    description: "Premium AI coaching with Claude 3.5 Sonnet, unlimited sessions, meal planning, nutrition tracking, and priority support.",
    cta: "Upgrade to Pro",
    highlighted: true,
    features: [
      { name: "AI Fitness Coach", included: true },
      { name: "Gemini 2.0 Flash AI", included: true },
      { name: "Basic workout plans", included: true },
      { name: "Form feedback on videos", included: true },
      { name: "Claude AI coaching", included: true },
      { name: "Advanced program customization", included: true },
      { name: "Priority support", included: false },
      { name: "Nutrition optimization", included: true },
    ],
  },
  {
    name: "Elite",
    price: "$39.99",
    period: "/month",
    description: "Premium coaching with priority support",
    cta: "Upgrade to Elite",
    highlighted: false,
    features: [
      { name: "AI Fitness Coach", included: true },
      { name: "Gemini 2.0 Flash AI", included: true },
      { name: "Basic workout plans", included: true },
      { name: "Form feedback on videos", included: true },
      { name: "Claude AI coaching", included: true },
      { name: "Advanced program customization", included: true },
      { name: "Priority support", included: true },
      { name: "Nutrition optimization", included: true },
    ],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleUpgrade = (tier: string) => {
    if (!user) {
      setLocation("/login");
      return;
    }
    setLocation("/account-settings");
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#d8c7a3] mb-4">Pricing Plans</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h1>
              <p className="text-lg text-muted-foreground mb-8">
            Choose the tier that fits your fitness goals. All plans include AI-powered coaching with real-time form feedback.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl border transition-all relative overflow-hidden ${
                tier.name === "Core+"
                  ? "border-[#8fe8d8]/30 bg-gradient-to-br from-[#8fe8d8]/[0.08] to-transparent hover:border-[#8fe8d8]/50"
                  : tier.name === "Pro"
                  ? "border-[#d8c7a3]/40 bg-gradient-to-br from-[#d8c7a3]/[0.12] to-transparent ring-2 ring-[#d8c7a3]/20 md:scale-105 hover:border-[#d8c7a3]/60"
                  : tier.name === "Elite"
                  ? "border-[#b9a7ff]/30 bg-gradient-to-br from-[#b9a7ff]/[0.08] to-transparent hover:border-[#b9a7ff]/50"
                  : "border-border bg-card hover:border-primary/50"
              } p-8 flex flex-col`}
            >
              <div className={`absolute top-0 left-0 h-1 w-full ${
                tier.name === "Core+" ? "bg-[#8fe8d8]/60" :
                tier.name === "Pro" ? "bg-[#d8c7a3]/70" :
                tier.name === "Elite" ? "bg-[#b9a7ff]/60" :
                "bg-[#ffc0cb]/50"
              }`} aria-hidden="true" />
              {tier.highlighted && (
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">{tier.description}</p>
              
              <div className="mb-6">
                <span className={`text-4xl font-bold ${
                  tier.name === "Core+" ? "text-[#8fe8d8]" :
                  tier.name === "Pro" ? "text-[#d8c7a3]" :
                  tier.name === "Elite" ? "text-[#b9a7ff]" :
                  "text-foreground"
                }`}>{tier.price}</span>
                <span className="text-muted-foreground text-sm">{tier.period}</span>
              </div>

              <Button
                onClick={() => handleUpgrade(tier.name)}
                variant={tier.highlighted ? "default" : "outline"}
                className="w-full mb-8"
              >
                {tier.cta}
              </Button>

              <div className="space-y-4 flex-1">
                {tier.features.map((feature) => (
                  <div key={feature.name} className="flex items-start gap-3">
                    <div
                      className={`mt-1 rounded-full p-0.5 ${
                        feature.included ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <Check
                        className={`w-4 h-4 ${
                          feature.included ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <span
                      className={`text-sm ${
                        feature.included ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>

              {tier.limitations && tier.limitations.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Limitations</p>
                  <ul className="space-y-2">
                    {tier.limitations.map((limitation) => (
                      <li key={limitation} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-muted-foreground mt-1">•</span>
                        <span>{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">Detailed Feature Comparison</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-card/50">
                  <th className="text-left px-6 py-4 font-semibold">Feature</th>
                  <th className="text-center px-4 py-4 font-semibold text-sm">Free</th>
                  <th className="text-center px-4 py-4 font-semibold text-sm">Core</th>
                  <th className="text-center px-4 py-4 font-semibold text-sm bg-primary/5">Pro</th>
                  <th className="text-center px-4 py-4 font-semibold text-sm">Elite</th>
                </tr>
              </thead>
              <tbody>
                {tiers[0].features.map((feature, idx) => (
                  <tr key={feature.name} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium text-sm">{feature.name}</td>
                    {tiers.map((tier) => (
                      <td
                        key={tier.name}
                        className={`text-center px-4 py-4 ${
                          tier.name === "Pro" ? "bg-primary/5" : ""
                        }`}
                      >
                        {tier.features[idx].included ? (
                          <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I change tiers anytime?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your tier at any time from your Account Settings. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What's the difference between Gemini and Claude AI?</h3>
              <p className="text-muted-foreground">
                Gemini 2.0 Flash is fast and cost-effective for basic coaching. Claude 3.5 Sonnet offers advanced reasoning for complex training periodization and nuanced nutrition strategies.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What are the free tier limitations?</h3>
              <p className="text-muted-foreground">
                The free tier includes 5 AI coaching sessions per week, basic workout plans, and form feedback on up to 3 videos per week. No meal planning or nutrition tracking is included. Upgrade to Core or higher for unlimited access.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-muted-foreground">
                We offer a 7-day money-back guarantee on all paid tiers. Contact support if you're not satisfied.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                Yes! The Free tier gives you full access to AI coaching with Gemini. Upgrade anytime to unlock Claude AI and advanced features.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
