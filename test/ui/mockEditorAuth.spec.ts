// Simple UI-level tests (non-Playwright) interacting with component helper functions
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { MockEditor } from "../../components/MockEditor";
import { MockEndpoint } from "../../types";

// Minimal render helpers without full DOM
function setup(initial?: Partial<MockEndpoint>) {
  const saved: MockEndpoint[] = [];
  const onSave = (m: MockEndpoint) => saved.push(m);
  const onDelete = (id: string) => { };
  const onCancel = () => { };
  const addToast = (m: string, t: any) => { };

  const utils = render(
    <MockEditor
      initialData={ initial as MockEndpoint }
      existingMocks = { []}
      onSave = { onSave }
      onDelete = { onDelete }
      onCancel = { onCancel }
      addToast = { addToast }
    />
  );
  return { ...utils, saved };
}

test("renders auth dropdown and updates preview for BEARER_TOKEN", () => {
  const { getByLabelText, getByText } = setup();
  const select = getByLabelText(/Authentication Type/i) as HTMLSelectElement;
  fireEvent.change(select, { target: { value: "BEARER_TOKEN" } });
  // Should display the expected header preview
  expect(getByText(/Expected Header/i)).toBeTruthy();
  expect(getByText(/Authorization: Bearer/i)).toBeTruthy();
});

test("renders API_KEY inputs and updates preview", () => {
  const { getByLabelText, getByText } = setup();
  const select = getByLabelText(/Authentication Type/i) as HTMLSelectElement;
  fireEvent.change(select, { target: { value: "API_KEY" } });
  const headerNameInput = getByLabelText(/Header Name/i) as HTMLInputElement;
  fireEvent.change(headerNameInput, { target: { value: "x-test-key" } });
  const keyInput = getByLabelText(/API Key Value/i) as HTMLInputElement;
  fireEvent.change(keyInput, { target: { value: "abc123" } });
  expect(getByText(/Expected Header/i)).toBeTruthy();
  expect(getByText(/x-test-key: abc123/i)).toBeTruthy();
});
