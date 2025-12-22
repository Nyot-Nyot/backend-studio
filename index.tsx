import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Register Service Worker for Network Simulation
if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("/sw.js")
			.then(registration => {
				console.log("SW registered: ", registration);
			})
			.catch(registrationError => {
				console.log("SW registration failed: ", registrationError);
			});
	});
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

import { dbService } from "./services/dbService";

(async () => {
	try {
		await dbService.init({ backend: "auto" });
	} catch (e) {
		console.warn("dbService init failed:", e);
	}

	root.render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
	);
})();
