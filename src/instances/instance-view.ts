import { Instance } from "../generated/prisma/client";
import { InstanceSummaryView, InstanceView } from "../types";

export function toInstanceSummary(instance: Instance): InstanceSummaryView {
	return {
		idInstance: Number(instance.idInstance),
		name: instance.name,
		messenger: instance.messenger,
		stateInstance: instance.stateInstance,
	};
}

export function toInstanceView(instance: Instance): InstanceView {
	return {
		idInstance: Number(instance.idInstance),
		name: instance.name,
		messenger: instance.messenger,
		stateInstance: instance.stateInstance,
		phone: instance.phone,
		receiveWebhooks: instance.receiveWebhooks,
	};
}
