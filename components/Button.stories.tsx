import Button from "./Button";

export default { title: "Components/Button", component: Button };

export const Primary = () => <Button varian="primary">Primary</Button>;
export const Ghost = () => <Button varian="ghost">Ghost</Button>;
export const Icon = () => <Button varian="icon">🔍</Button>;
