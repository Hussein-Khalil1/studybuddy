export default function RewardsPage() {
  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Rewards
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">Rewards</h1>
      </div>

      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-10 shadow-sm text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-xl font-bold text-[#2a2028] mb-3">Rewards Coming Soon</h2>
        <p className="text-sm text-[rgba(42,32,40,0.55)] max-w-sm mx-auto leading-relaxed">
          Earn points and badges for staying active in your study groups, completing assignments,
          and helping your groupmates succeed.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4 max-w-xs mx-auto">
          {[
            { emoji: "⭐", label: "Points" },
            { emoji: "🎖️", label: "Badges" },
            { emoji: "📈", label: "Streaks" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-[#f8f6f4] rounded-xl p-4 border border-[rgba(0,0,0,0.05)]"
            >
              <div className="text-2xl mb-1">{item.emoji}</div>
              <p className="text-xs font-medium text-[rgba(42,32,40,0.55)]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
