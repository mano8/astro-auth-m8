export function SignupView() {
  return (
    <section className="not-content fa-auth-panel mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border/70 bg-card/95 p-6 text-card-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Signup unavailable</h1>
      <p className="text-sm text-muted-foreground">
        This backend protects public signup by default. Use the headless user APIs for admin-created users.
      </p>
    </section>
  );
}
