const { chromium } = require("playwright");
(async () => {
	const ports = [3000, 3001, 5173];
	for (const port of ports) {
		try {
			const url = `http://localhost:${port}`;
			const browser = await chromium.launch();
			const page = await browser.newPage();
			console.log("Trying", url);
			const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 }).catch(e => null);
			if (!resp) {
				console.log("No response for", url);
				await browser.close();
				continue;
			}
			console.log("Status", resp.status());

			// Seed data similar to test
			await page.evaluate(() => {
				localStorage.clear();
				const projects = [{ id: "p-e2e", name: "E2E Project", createdAt: Date.now() }];
				const mocks = [
					{
						id: "m-e2e",
						projectId: "p-e2e",
						name: "E2E",
						path: "/api/e2e",
						method: "GET",
						statusCode: 200,
						delay: 0,
						responseBody: '{"ok":true}',
						isActive: true,
						version: "1.0",
						createdAt: Date.now(),
						requestCount: 0,
						headers: [{ key: "Content-Type", value: "application/json" }],
						storeName: "",
						authConfig: { type: "NONE" },
					},
				];
				const envVars = [
					{ id: "env-e2e", projectId: "p-e2e", key: "BASE_URL", value: "http://localhost:3000" },
				];
				localStorage.setItem("api_sim_projects", JSON.stringify(projects));
				localStorage.setItem("api_sim_mocks", JSON.stringify(mocks));
				localStorage.setItem("api_sim_env_vars", JSON.stringify(envVars));
				localStorage.setItem("api_sim_active_project", "p-e2e");
			});

			await page.reload({ waitUntil: "networkidle" }).catch(() => {});

			// Try to open Configuration nav
			const config = page.locator("text=Configuration").first();
			console.log("Configuration count", await config.count());
			if ((await config.count()) > 0) {
				await config.click().catch(() => {});
				await page.waitForTimeout(500);
			}

			// Scroll to Data Storage Migration or Database Management
			const ds = page.locator("text=Data Storage Migration").first();
			console.log("Data Storage Migration count", await ds.count());
			if ((await ds.count()) > 0) {
				await ds.scrollIntoViewIfNeeded().catch(() => {});
				await page.waitForTimeout(300);
			}

			// Also try to find the panel by heading text
			const panel = page.locator("text=Database Management").first();
			console.log("Database Management panel count", await panel.count());

			// Locate label and input
			const label = page.locator('label:has-text("Import Data")').first();
			const labelCount = await label.count();
			console.log("Label count:", labelCount);
			if (labelCount > 0) {
				const html = await label.evaluate(n => n.outerHTML);
				console.log("Label outerHTML:", html);
				const input = label.locator('input[type="file"]').first();
				console.log("Input count under label:", await input.count());
				if ((await input.count()) > 0) {
					const attrs = await input.evaluate(n => {
						return {
							type: n.type,
							accept: n.accept,
							disabled: n.disabled,
							hidden: n.hidden,
							style: n.getAttribute("style"),
							class: n.getAttribute("class"),
							visible: !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length),
						};
					});
					console.log("Input attributes:", attrs);
				}
			} else {
				// fallback: search all file inputs
				const allInputs = page.locator('input[type="file"]');
				console.log("All file inputs count:", await allInputs.count());
				if ((await allInputs.count()) > 0) {
					const outer = await allInputs.first().evaluate(n => n.outerHTML);
					console.log("First input outerHTML:", outer);
				}
			}

			await browser.close();
			return;
		} catch (e) {
			console.log("Error for port", port, e.message);
		}
	}
	console.log("Could not reach dev server");
	process.exit(1);
})();
