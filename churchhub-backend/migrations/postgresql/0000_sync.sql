CREATE TABLE "bucket_objects" (
	"church_id" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"seq" integer NOT NULL,
	CONSTRAINT "bucket_objects_church_id_key_pk" PRIMARY KEY("church_id","key")
);
--> statement-breakpoint
CREATE TABLE "churches" (
	"id" text PRIMARY KEY NOT NULL,
	"path_secret" text NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"commit_nonce" text,
	"snapshot_seq" integer DEFAULT 0 NOT NULL,
	"snapshot_key" text,
	"owner_google_sub" text,
	"owner_email" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"church_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"is_server" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"revoked_at" bigint,
	CONSTRAINT "devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"church_id" text NOT NULL,
	"type" text NOT NULL,
	"uuid" text NOT NULL,
	"version" integer NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"content_hash" text,
	"created_by" text,
	"updated_by" text,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "entities_church_id_type_uuid_pk" PRIMARY KEY("church_id","type","uuid")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"church_id" text NOT NULL,
	"role_id" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_church_id_role_id_permission_pk" PRIMARY KEY("church_id","role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"church_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "roles_church_id_id_pk" PRIMARY KEY("church_id","id")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"church_id" text NOT NULL,
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "user_permissions_church_id_user_id_permission_pk" PRIMARY KEY("church_id","user_id","permission")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"church_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"role_id" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "users_church_id_id_pk" PRIMARY KEY("church_id","id")
);
--> statement-breakpoint
CREATE INDEX "idx_bucket_objects_seq" ON "bucket_objects" USING btree ("church_id","kind","seq");--> statement-breakpoint
CREATE INDEX "idx_devices_church" ON "devices" USING btree ("church_id");