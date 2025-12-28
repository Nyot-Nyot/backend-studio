import Button from "./Button";
import Modal from "./Modal";

export default { title: "Components/Modal", component: Modal };

export const Basic = () => (
	<Modal
		isOpen={true}
		onClose={() => {}}
		title={<span>Contoh Modal</span>}
		description={<span>Deskripsi singkat</span>}
	>
		<p>Konten modal</p>
		<div className="mt-4 flex justify-end gap-3">
			<Button variant="ghost">Batal</Button>
			<Button variant="primary">Ok</Button>
		</div>
	</Modal>
);
