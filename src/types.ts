import { Request } from "express";
import { AutomationKey, Base, BaseUser, Instance, InstanceState, Messenger, PermissionLevel, SendJob, SendJobItem, UserInstance } from "./generated/prisma/client";

export type UserWithInstances = BaseUser & { instances: UserInstance[] };

export interface AuthReq extends Request {
	base: Base;
	user: UserWithInstances;
}

export interface AutomationReq extends Request {
	base: Base;
	automationKey: AutomationKey;
}

export interface CheckResult {
	phone: string;
	exists: boolean | null;
	chatId: string | null;
	error: string | null;
}

export interface ImportResult {
	imported: number;
	skipped: number;
}

export interface QrView {
	status: "qr" | "authorized" | "error";
	image: string | null;
	message: string | null;
}

export interface QueueView {
	count: number;
}

export interface ContactView {
	chatId: string;
	name: string;
	phone: string | null;
	username: string | null;
}

export interface AutomationKeyView {
	id: string;
	name: string;
	idInstance: number | null;
	createdAt: string;
	lastUsedAt: string | null;
}

export interface AutomationSendResult {
	jobId: string;
	status: "sent" | "failed" | "queued";
	chatId: string;
	idMessage: string | null;
	error: string | null;
}

export interface UserView {
	id: string;
	airtableUserId: string;
	email: string | null;
	name: string | null;
	permissionLevel: PermissionLevel;
	isAdmin: boolean;
	idInstances: number[];
	hasKey: boolean;
	lastSeenAt: string;
}

export interface ClaimResponse {
	personalKey: string;
	user: UserView;
}

export type ButtonType = "copy" | "call" | "url" | "reply";

export interface OutboundButton {
	type: ButtonType;
	text: string;
	value?: string;
}

export type OutboundPayload =
	| { type: "text"; text: string }
	| { type: "file"; url: string; fileName: string; caption?: string }
	| { type: "location"; latitude: number; longitude: number; name?: string; address?: string }
	| { type: "contact"; phone: string; firstName?: string; middleName?: string; lastName?: string; company?: string }
	| { type: "poll"; question: string; options: string[]; multipleAnswers: boolean }
	| { type: "buttons"; header?: string; body: string; footer?: string; buttons: OutboundButton[] };

export interface SendJobItemInput {
	chatId: string;
	payload: OutboundPayload;
}

export type StatusFieldType = "singleSelect" | "text";

export interface JobWriteBack {
	tableId: string;
	statusFieldId: string | null;
	statusFieldType: StatusFieldType | null;
}

export interface InboundFieldMap {
	direction?: string;
	chatId?: string;
	senderName?: string;
	contact?: string;
	type?: string;
	text?: string;
	attachments?: string;
	timestamp?: string;
	idMessage: string;
	status?: string;
	instance?: string;
	quotedMessageId?: string;
	location?: string;
	details?: string;
}

export interface InboundConfig {
	tableId: string;
	fields: InboundFieldMap;
	contactLink: { tableId: string; phoneFieldId: string; chatIdFieldId: string | null } | null;
}

export interface InstanceView {
	idInstance: number;
	name: string | null;
	messenger: Messenger;
	stateInstance: InstanceState | null;
	phone: string | null;
	receiveWebhooks: boolean;
}

export interface InstanceSummaryView {
	idInstance: number;
	name: string | null;
	messenger: Messenger;
	stateInstance: InstanceState | null;
}

export interface AirtableAuthView {
	connected: boolean;
	scope: string | null;
	expiresAt: string | null;
}

export interface BaseView {
	baseId: string;
	airtable: AirtableAuthView;
	inbound: InboundConfig | null;
	webhookUrl: string;
	instances: InstanceSummaryView[];
	me: UserView;
}

export interface SendJobItemView {
	recordId: string | null;
	chatId: string;
	status: SendJobItem["status"];
	idMessage: string | null;
	error: string | null;
}

export interface SendJobSummaryView {
	id: string;
	idInstance: number;
	status: SendJob["status"];
	total: number;
	sent: number;
	failed: number;
	createdAt: string;
	finishedAt: string | null;
}

export interface SendJobView extends SendJobSummaryView {
	items: SendJobItemView[];
}

export type InstanceWithBase = Instance & { base: Base };
