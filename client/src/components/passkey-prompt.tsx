import { useState, useEffect } from "react";
import { Fingerprint, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const PASSKEY_PROMPT_DISMISSED_KEY = "passkey-prompt-dismissed";
const PASSKEY_PROMPT_DELAY_KEY = "passkey-prompt-delay-until";

interface PasskeyPromptProps {
	/** Whether the user just signed in via magic link */
	showAfterMagicLink?: boolean;
}

export function PasskeyPrompt({
	showAfterMagicLink = false,
}: PasskeyPromptProps) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);

	useEffect(() => {
		if (!showAfterMagicLink) return;

		// Check if user has dismissed the prompt permanently
		const dismissed = localStorage.getItem(PASSKEY_PROMPT_DISMISSED_KEY);
		if (dismissed === "true") return;

		// Check if user has delayed the prompt
		const delayUntil = localStorage.getItem(PASSKEY_PROMPT_DELAY_KEY);
		if (delayUntil && Date.now() < parseInt(delayUntil, 10)) return;

		// Check if user already has passkeys
		checkPasskeys();
	}, [showAfterMagicLink]);

	async function checkPasskeys() {
		try {
			const result = await authClient.passkey.listUserPasskeys();
			const userHasPasskeys = result.data && result.data.length > 0;
			setHasPasskey(userHasPasskeys);

			// Only show prompt if user doesn't have passkeys
			if (!userHasPasskeys) {
				// Small delay before showing the prompt for better UX
				setTimeout(() => setOpen(true), 1000);
			}
		} catch (err) {
			console.error("Error checking passkeys:", err);
			setHasPasskey(false);
		}
	}

	async function handleAddPasskey() {
		setLoading(true);
		try {
			await authClient.passkey.addPasskey();
			setSuccess(true);
			toast.success("Passkey added successfully!");

			// Close dialog after a brief moment to show success
			setTimeout(() => {
				setOpen(false);
				// Clear the URL param
				const url = new URL(window.location.href);
				url.searchParams.delete("auth");
				window.history.replaceState({}, "", url.toString());
			}, 1500);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to add passkey";
			// Check if user cancelled
			if (message.includes("cancelled") || message.includes("abort")) {
				// Don't show error for cancellation
				return;
			}
			toast.error(message);
			console.error(err);
		} finally {
			setLoading(false);
		}
	}

	function handleRemindLater() {
		// Delay prompt for 7 days
		const delayUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
		localStorage.setItem(PASSKEY_PROMPT_DELAY_KEY, delayUntil.toString());
		setOpen(false);
		// Clear the URL param
		const url = new URL(window.location.href);
		url.searchParams.delete("auth");
		window.history.replaceState({}, "", url.toString());
	}

	function handleDismiss() {
		// Permanently dismiss
		localStorage.setItem(PASSKEY_PROMPT_DISMISSED_KEY, "true");
		setOpen(false);
		// Clear the URL param
		const url = new URL(window.location.href);
		url.searchParams.delete("auth");
		window.history.replaceState({}, "", url.toString());
	}

	if (hasPasskey === null || hasPasskey === true) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
						{success ? (
							<CheckCircle className="h-8 w-8 text-green-500" />
						) : (
							<Fingerprint className="h-8 w-8 text-primary" />
						)}
					</div>
					<DialogTitle className="text-center">
						{success ? "Passkey Added!" : "Sign in faster next time"}
					</DialogTitle>
					<DialogDescription className="text-center">
						{success
							? "You can now sign in instantly with your passkey."
							: "Add a passkey to sign in instantly with Face ID, Touch ID, or your security key - no more waiting for emails."}
					</DialogDescription>
				</DialogHeader>

				{!success && (
					<>
						<div className="space-y-3 py-4">
							<div className="flex items-start gap-3 text-sm">
								<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
									1
								</div>
								<p className="text-muted-foreground">
									Click "Add Passkey" below
								</p>
							</div>
							<div className="flex items-start gap-3 text-sm">
								<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
									2
								</div>
								<p className="text-muted-foreground">
									Use your device's biometric (Face ID, Touch ID, Windows Hello)
									or security key
								</p>
							</div>
							<div className="flex items-start gap-3 text-sm">
								<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
									3
								</div>
								<p className="text-muted-foreground">
									Next time, just enter your email and use your passkey - no
									email needed!
								</p>
							</div>
						</div>

						<DialogFooter className="flex-col gap-2 sm:flex-col">
							<Button
								onClick={handleAddPasskey}
								disabled={loading}
								className="w-full"
							>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Setting up...
									</>
								) : (
									<>
										<Fingerprint className="mr-2 h-4 w-4" />
										Add Passkey
									</>
								)}
							</Button>
							<Button
								onClick={handleRemindLater}
								variant="outline"
								className="w-full"
								disabled={loading}
							>
								Remind Me Later
							</Button>
							<button
								onClick={handleDismiss}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors"
								disabled={loading}
							>
								Don't show this again
							</button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
