import Input from "./Input";

export default { title: "Components/Input", component: Input };

export const Default = () => <Input label="Name" placeholder="Full name" />;
export const WithError = () => <Input label="Email" error="Invalid email" />;
