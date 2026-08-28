import { useEffect, useState } from "react";
import {
  useApp,
  UNIVERSITY_EMAIL_DOMAIN,
  isUniversityEmail,
} from "../../context/AppContext";
import { supabase } from "../../lib/supabase";

const DEPARTMENTS = [
 "SCHOOL OF BUSSINESS AND SOCIAL SCIENCE",
 "SCHOOL OF EDUCATION AND HUMAN SCIENCE",
 "SCHOOL OF COMPUTIG AND INFORMATICS",
 "LANGUAGUE CENTER",
 "CENTER FOR FOUNDATION AND GENERAL STUDIES",
 "STAFF OR LECTURER"
];

const YEARS = [
  "Foundation",
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Postgraduate",
];

export default function AuthModal() {
  const {
    authModal,
    closeAuthModal,
    openAuthModal,
    passwordRecovery,
    cancelPasswordRecovery,
    completePasswordRecovery,
  } = useApp();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    newPassword: "",
    confirmPassword: "",
    department: "",
    year: "",
    whatsapp: "",
    remember: false,
    terms: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [resetCooldownUntil, setResetCooldownUntil] = useState<number>(() => {
    try {
      return Number(
        localStorage.getItem("aiu_reset_email_cooldown_until") || 0
      );
    } catch {
      return 0;
    }
  });

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setErrors({});
    setSuccess("");
    setSubmitting(false);

    // Reset password visibility whenever the modal/page changes
    setShowLoginPassword(false);
    setShowSignupPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, [authModal]);

  if (!authModal) return null;

  function update(field: string, value: string | boolean) {
    setForm((f) => ({
      ...f,
      [field]: value,
    }));

    setErrors((e) => {
      const n = { ...e };
      delete n[field];
      delete n.form;
      return n;
    });
  }

  function validateEmail(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    return isUniversityEmail(email);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const errs: Record<string, string> = {};

    if (!form.email) {
      errs.email = "Email is required";
    } else if (!validateEmail(form.email)) {
      errs.email = `Please use your AIU university email (@${UNIVERSITY_EMAIL_DOMAIN})`;
    }

    if (!form.password) {
      errs.password = "Password is required";
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    setSubmitting(false);

    if (error) {
      setErrors({
        form: error.message,
      });
      return;
    }

    localStorage.setItem(
      "aiu_session_only",
      String(!form.remember)
    );

    closeAuthModal();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const errs: Record<string, string> = {};

    if (!form.name) {
      errs.name = "Name is required";
    }

    if (!form.email) {
      errs.email = "Email is required";
    } else if (!validateEmail(form.email)) {
      errs.email = `Please use your AIU university email (@${UNIVERSITY_EMAIL_DOMAIN})`;
    }

    if (!form.password || form.password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    }

    if (!form.department) {
      errs.department = "Department is required";
    }

    if (!form.year) {
      errs.year = "Year of study is required";
    }

    if (!form.whatsapp) {
      errs.whatsapp = "WhatsApp number is required";
    }

    if (!form.terms) {
      errs.terms = "You must accept the Terms of Use";
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);

    const profile = {
      name: form.name,
      email: form.email,
      department: form.department,
      year: form.year,
      whatsapp: form.whatsapp,
      has_shop: false,
      is_admin: false,
    };

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: profile,
      },
    });

    if (error || !data.user) {
      setSubmitting(false);

      setErrors({
        form: error?.message || "Could not create account",
      });

      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: data.user.id,
        ...profile,
      });

    setSubmitting(false);

    if (profileError) {
      console.warn(
        "Profile could not be saved during signup:",
        profileError.message
      );
    }

    localStorage.setItem(
      "aiu_session_only",
      String(!form.remember)
    );

    if (data.session) {
      closeAuthModal();
    } else {
      setSuccess(
        `Account created for ${form.email}. Check your email to confirm your account before logging in.`
      );
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();

    const errs: Record<string, string> = {};

    if (!form.email) {
      errs.email = "Email is required";
    } else if (!validateEmail(form.email)) {
      errs.email = `Please use your AIU university email (@${UNIVERSITY_EMAIL_DOMAIN})`;
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const now = Date.now();

    if (resetCooldownUntil > now) {
      const seconds = Math.max(
        1,
        Math.ceil((resetCooldownUntil - now) / 1000)
      );

      setErrors({
        form: `Please wait ${seconds} seconds before requesting another reset email.`,
      });

      return;
    }

    setSubmitting(true);

    const redirectTo = window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(
      form.email,
      {
        redirectTo,
      }
    );

    setSubmitting(false);

    if (error) {
      const message = /rate limit|too many|email rate/i.test(
        error.message
      )
        ? "Supabase has temporarily rate-limited password-reset emails. Please wait before trying again. For production, configure a custom SMTP provider in Supabase Auth."
        : error.message;

      setErrors({
        form: message,
      });

      return;
    }

    const cooldown = Date.now() + 60_000;

    setResetCooldownUntil(cooldown);

    try {
      localStorage.setItem(
        "aiu_reset_email_cooldown_until",
        String(cooldown)
      );
    } catch {}

    setSuccess(
      `A password reset link has been sent to ${form.email}`
    );
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();

    const errs: Record<string, string> = {};

    if (
      !form.newPassword ||
      form.newPassword.length < 8
    ) {
      errs.newPassword =
        "Password must be at least 8 characters";
    }

    if (form.confirmPassword !== form.newPassword) {
      errs.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({
      password: form.newPassword,
    });

    setSubmitting(false);

    if (error) {
      setErrors({
        form: error.message,
      });

      return;
    }

    await completePasswordRecovery();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={
        passwordRecovery
          ? undefined
          : closeAuthModal
      }
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1C3270] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="font-bold text-xl"
                style={{
                  fontFamily: "Lora, serif",
                }}
              >
                {authModal === "login"
                  ? "Welcome back"
                  : authModal === "signup"
                  ? "Join AIU Market"
                  : authModal === "reset"
                  ? "Set a new password"
                  : "Reset password"}
              </h2>

              <p className="text-white/70 text-sm mt-0.5">
                {authModal === "login"
                  ? "Log in to your account"
                  : authModal === "signup"
                  ? "Create your free account"
                  : authModal === "reset"
                  ? "Choose a new password to finish resetting"
                  : "We'll send a reset link to your email"}
              </p>
            </div>

            {!passwordRecovery && (
              <button
                onClick={closeAuthModal}
                className="text-white/60 hover:text-white text-2xl leading-none ml-4"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {errors.form && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errors.form}
            </div>
          )}

          {success ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">
                📧
              </div>

              <p className="text-stone-700 font-medium">
                {success}
              </p>

              <p className="text-stone-400 text-sm mt-1">
                Check your inbox and follow the instructions.
              </p>

              <button
                onClick={closeAuthModal}
                className="mt-4 px-6 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium hover:bg-[#0F1F4A]"
              >
                Close
              </button>
            </div>
          ) : authModal === "login" ? (
            <form
              onSubmit={handleLogin}
              className="space-y-4"
            >
              <Field
                label="Email"
                error={errors.email}
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    update("email", e.target.value)
                  }
                  placeholder="you@aiu.edu.my"
                  className={input(errors.email)}
                />
              </Field>

              <Field
                label="Password"
                error={errors.password}
              >
                <PasswordInput
                  value={form.password}
                  onChange={(value) =>
                    update("password", value)
                  }
                  placeholder="••••••••"
                  error={errors.password}
                  showPassword={showLoginPassword}
                  setShowPassword={setShowLoginPassword}
                />
              </Field>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={(e) =>
                      update(
                        "remember",
                        e.target.checked
                      )
                    }
                    className="accent-[#1C3270]"
                  />

                  <span className="text-stone-600">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    openAuthModal("forgot")
                  }
                  className="text-[#1C3270] hover:text-[#0F1F4A] font-medium"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#1C3270] text-white rounded-xl font-semibold hover:bg-[#0F1F4A] transition-colors disabled:opacity-60"
              >
                {submitting
                  ? "Logging in..."
                  : "Log in"}
              </button>

              <p className="text-center text-sm text-stone-500">
                No account yet?{" "}

                <button
                  type="button"
                  onClick={() =>
                    openAuthModal("signup")
                  }
                  className="text-[#1C3270] font-medium hover:text-[#0F1F4A]"
                >
                  Sign up
                </button>
              </p>
            </form>
          ) : authModal === "signup" ? (
            <form
              onSubmit={handleSignup}
              className="space-y-4"
            >
              <Field
                label="Full Name"
                error={errors.name}
              >
                <input
                  value={form.name}
                  onChange={(e) =>
                    update("name", e.target.value)
                  }
                  placeholder="Ahmad Faris bin Abdullah"
                  className={input(errors.name)}
                />
              </Field>

              <Field
                label="Email"
                error={errors.email}
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    update("email", e.target.value)
                  }
                  placeholder="you@aiu.edu.my"
                  className={input(errors.email)}
                />
              </Field>

              <Field
                label="Password"
                error={errors.password}
              >
                <PasswordInput
                  value={form.password}
                  onChange={(value) =>
                    update("password", value)
                  }
                  placeholder="Min. 8 characters"
                  error={errors.password}
                  showPassword={showSignupPassword}
                  setShowPassword={
                    setShowSignupPassword
                  }
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Department"
                  error={errors.department}
                >
                  <select
                    value={form.department}
                    onChange={(e) =>
                      update(
                        "department",
                        e.target.value
                      )
                    }
                    className={input(errors.department)}
                  >
                    <option value="">
                      Select...
                    </option>

                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Year of Study"
                  error={errors.year}
                >
                  <select
                    value={form.year}
                    onChange={(e) =>
                      update(
                        "year",
                        e.target.value
                      )
                    }
                    className={input(errors.year)}
                  >
                    <option value="">
                      Select...
                    </option>

                    {YEARS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="WhatsApp Number"
                error={errors.whatsapp}
              >
                <input
                  value={form.whatsapp}
                  onChange={(e) =>
                    update(
                      "whatsapp",
                      e.target.value
                    )
                  }
                  placeholder="60123456789 (with country code)"
                  className={input(errors.whatsapp)}
                />
              </Field>

              <Field
                label=""
                error={errors.terms}
              >
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={(e) =>
                      update(
                        "terms",
                        e.target.checked
                      )
                    }
                    className="accent-[#1C3270] mt-0.5"
                  />

                  <span className="text-sm text-stone-600">
                    I agree to the{" "}

                    <a
                      href="/terms"
                      className="text-[#1C3270] hover:underline"
                    >
                      Terms of Use
                    </a>
                  </span>
                </label>
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#1C3270] text-white rounded-xl font-semibold hover:bg-[#0F1F4A] transition-colors disabled:opacity-60"
              >
                {submitting
                  ? "Creating account..."
                  : "Create Account"}
              </button>

              <p className="text-center text-sm text-stone-500">
                Already have an account?{" "}

                <button
                  type="button"
                  onClick={() =>
                    openAuthModal("login")
                  }
                  className="text-[#1C3270] font-medium hover:text-[#0F1F4A]"
                >
                  Log in
                </button>
              </p>
            </form>
          ) : authModal === "forgot" ? (
            <form
              onSubmit={handleForgot}
              className="space-y-4"
            >
              <Field
                label="Email"
                error={errors.email}
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    update("email", e.target.value)
                  }
                  placeholder="you@aiu.edu.my"
                  className={input(errors.email)}
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#1C3270] text-white rounded-xl font-semibold hover:bg-[#0F1F4A] transition-colors disabled:opacity-60"
              >
                {submitting
                  ? "Sending..."
                  : "Send Reset Link"}
              </button>

              <p className="text-center text-sm text-stone-500">
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal("login")
                  }
                  className="text-[#1C3270] font-medium"
                >
                  ← Back to login
                </button>
              </p>
            </form>
          ) : (
            <form
              onSubmit={handleSetNewPassword}
              className="space-y-4"
            >
              <p className="text-sm text-stone-500 -mt-1">
                Your reset link has been verified.
                Choose a new password to finish
                logging in — your old password will
                stop working.
              </p>

              <Field
                label="New Password"
                error={errors.newPassword}
              >
                <PasswordInput
                  value={form.newPassword}
                  onChange={(value) =>
                    update("newPassword", value)
                  }
                  placeholder="Min. 8 characters"
                  error={errors.newPassword}
                  showPassword={showNewPassword}
                  setShowPassword={
                    setShowNewPassword
                  }
                />
              </Field>

              <Field
                label="Confirm New Password"
                error={errors.confirmPassword}
              >
                <PasswordInput
                  value={form.confirmPassword}
                  onChange={(value) =>
                    update(
                      "confirmPassword",
                      value
                    )
                  }
                  placeholder="Re-enter new password"
                  error={errors.confirmPassword}
                  showPassword={
                    showConfirmPassword
                  }
                  setShowPassword={
                    setShowConfirmPassword
                  }
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#1C3270] text-white rounded-xl font-semibold hover:bg-[#0F1F4A] transition-colors disabled:opacity-60"
              >
                {submitting
                  ? "Saving..."
                  : "Save New Password"}
              </button>

              <p className="text-center text-sm text-stone-500">
                <button
                  type="button"
                  onClick={
                    cancelPasswordRecovery
                  }
                  className="text-stone-400 hover:text-stone-600 font-medium"
                >
                  Cancel and sign out
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  error,
  showPassword,
  setShowPassword,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  showPassword: boolean;
  setShowPassword: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}) {
  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${input(error)} pr-11`}
      />

      <button
        type="button"
        onClick={() =>
          setShowPassword((current) => !current)
        }
        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
        aria-label={
          showPassword
            ? "Hide password"
            : "Show password"
        }
        title={
          showPassword
            ? "Hide password"
            : "Show password"
        }
      >
        {showPassword ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18"
            />

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.58 10.58a2 2 0 002.84 2.84"
            />

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.88 4.24A10.94 10.94 0 0112 4c5 0 8.27 4.11 9 8a10.94 10.94 0 01-2.12 4.41"
            />

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.61 6.61A10.97 10.97 0 003 12c.73 3.89 4 8 9 8a9.9 9.9 0 005.39-1.61"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.06 12.35a1 1 0 010-.7C3.55 7.78 7.34 5 12 5s8.45 2.78 9.94 6.65a1 1 0 010 .7C20.45 16.22 16.66 19 12 19s-8.45-2.78-9.94-6.65z"
            />

            <circle
              cx="12"
              cy="12"
              r="3"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-stone-700 mb-1">
          {label}
        </label>
      )}

      {children}

      {error && (
        <p className="text-xs text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

function input(error?: string) {
  return `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none transition-colors ${
    error
      ? "border-red-300 focus:border-red-400 bg-red-50"
      : "border-stone-200 focus:border-[#1C3270] bg-stone-50"
  }`;
}