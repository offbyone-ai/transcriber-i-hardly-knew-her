// Mobile transcription info component
// Shows information about server vs local transcription on mobile devices

import { Cloud, Shield, HardDrive, Smartphone, X } from "lucide-react";
import { useState, useEffect } from "react";
import {
	isMobileDevice,
	canUseLocalTranscription,
} from "@/lib/device-detection";
import { Button } from "@/components/ui/button";

type MobileTranscriptionInfoProps = {
	mode: "server" | "local";
	onDismiss?: () => void;
	showDismiss?: boolean;
};

export function MobileTranscriptionInfo({
	mode,
	onDismiss,
	showDismiss = true,
}: MobileTranscriptionInfoProps) {
	const [dismissed, setDismissed] = useState(false);
	const isMobile = isMobileDevice();
	const canUseLocal = canUseLocalTranscription();

	// Check if already dismissed this session
	useEffect(() => {
		if (sessionStorage.getItem("mobileTranscriptionInfoDismissed") === "true") {
			setDismissed(true);
		}
	}, []);

	// Don't show on desktop
	if (!isMobile) return null;

	// Don't show if dismissed
	if (dismissed) return null;

	const handleDismiss = () => {
		setDismissed(true);
		onDismiss?.();
		// Remember dismissal in session
		sessionStorage.setItem("mobileTranscriptionInfoDismissed", "true");
	};

	if (mode === "server") {
		return (
			<div className="relative p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
				{showDismiss && (
					<Button
						onClick={handleDismiss}
						className="absolute top-2 right-2 p-1 text-blue-600/50 hover:text-blue-600 dark:text-blue-400/50 dark:hover:text-blue-400 rounded"
					>
						<X size={16} />
					</Button>
				)}
				<div className="flex gap-3">
					<Cloud
						className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
						size={20}
					/>
					<div className="flex-1 pr-6">
						<h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
							<Smartphone size={16} />
							Mobile Mode: Server Processing
						</h4>
						<p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
							Your device is using server transcription for best performance.
							Audio is processed securely and{" "}
							<strong>deleted immediately</strong> after transcription - nothing
							is stored.
						</p>
						<div className="flex items-center gap-4 mt-2 text-xs text-blue-600 dark:text-blue-400">
							<span className="flex items-center gap-1">
								<Shield size={12} />
								Audio not stored
							</span>
							<span>3 free/month</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Local mode on mobile (with warning if no WebGPU)
	return (
		<div className="relative p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
			{showDismiss && (
				<Button
					onClick={handleDismiss}
					className="absolute top-2 right-2 p-1 text-amber-600/50 hover:text-amber-600 dark:text-amber-400/50 dark:hover:text-amber-400 rounded"
				>
					<X size={16} />
				</Button>
			)}
			<div className="flex gap-3">
				<HardDrive
					className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
					size={20}
				/>
				<div className="flex-1 pr-6">
					<h4 className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
						<Smartphone size={16} />
						Mobile Mode: Local Processing
					</h4>
					<p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
						{canUseLocal ? (
							<>
								Running AI locally on your device. This uses more memory and may
								be slower. Switch to <strong>server mode</strong> for better
								performance.
							</>
						) : (
							<>
								Local transcription may not work well on your device due to
								memory constraints. Consider using <strong>server mode</strong>{" "}
								instead.
							</>
						)}
					</p>
				</div>
			</div>
		</div>
	);
}

export function MobileServerModeIndicator({
	remaining,
}: {
	remaining: number;
}) {
	const isMobile = isMobileDevice();

	if (!isMobile) return null;

	return (
		<div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
			<Cloud size={12} />
			<span>Server mode</span>
			<span className="text-blue-500 dark:text-blue-400">
				({remaining} left)
			</span>
		</div>
	);
}
