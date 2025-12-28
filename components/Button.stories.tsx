import Button from "./Button";

export default { title: "Components/Button", component: Button };

export const Primary = () => <Button variant="primary">Primary</Button>;
export const Ghost = () => <Button variant="ghost">Ghost</Button>;
export const Icon = () => <Button variant="icon">🔍</Button>;
