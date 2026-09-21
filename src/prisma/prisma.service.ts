import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Base, Instance, InstanceState, Messenger, PrismaClient } from "../generated/prisma/client";
import { Instance as LibraryInstance, StorageProvider } from "@green-api/greenapi-integration";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy, StorageProvider<Base, Instance> {
	constructor(config: ConfigService) {
		super({adapter: new PrismaMariaDb(config.getOrThrow<string>("DATABASE_URL"))});
	}

	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}

	async createInstance(instance: LibraryInstance & { apiUrl: string; messenger: Messenger; phone: string | null }): Promise<Instance> {
		return this.instance.create({
			data: {
				idInstance: BigInt(instance.idInstance),
				apiTokenInstance: instance.apiTokenInstance,
				apiUrl: instance.apiUrl,
				stateInstance: instance.stateInstance ?? null,
				messenger: instance.messenger,
				phone: instance.phone ?? null,
				checkedAt: new Date(),
				settings: instance.settings ?? {},
				name: instance.name ?? null,
				baseId: instance.baseId,
			},
		});
	}

	async getInstance(idInstance: number | bigint): Promise<Instance | null> {
		return this.instance.findUnique({where: {idInstance: BigInt(idInstance)}});
	}

	async removeInstance(idInstance: number | bigint): Promise<Instance> {
		return this.instance.delete({where: {idInstance: BigInt(idInstance)}});
	}

	async updateInstanceState(idInstance: number | bigint, stateInstance: InstanceState): Promise<Instance> {
		return this.instance.update({where: {idInstance: BigInt(idInstance)}, data: {stateInstance, checkedAt: new Date()}});
	}

	async updateInstanceStatus(idInstance: bigint, stateInstance: InstanceState, phone: string | null): Promise<Instance> {
		return this.instance.update({where: {idInstance}, data: {stateInstance, phone, checkedAt: new Date()}});
	}

	async getInstancesByBase(baseId: string): Promise<Instance[]> {
		return this.instance.findMany({where: {baseId}, orderBy: {createdAt: "asc"}});
	}

	async createUser(data: Pick<Base, "id">): Promise<Base> {
		return this.base.create({data: {id: data.id}});
	}

	async findUser(identifier: string): Promise<Base | null> {
		return this.base.findUnique({where: {id: identifier}});
	}

	async updateUser(identifier: string, data: Partial<Pick<Base, "id">>): Promise<Base> {
		return this.base.update({where: {id: identifier}, data});
	}
}
