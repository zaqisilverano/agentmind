CREATE TABLE "brains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"synth" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brains_user_number_uq" UNIQUE("user_id","number")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"brain_id" uuid NOT NULL,
	"a" text NOT NULL,
	"b" text NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"by" text NOT NULL,
	CONSTRAINT "links_brain_id_a_b_pk" PRIMARY KEY("brain_id","a","b")
);
--> statement-breakpoint
CREATE TABLE "log_entries" (
	"brain_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"agent" text NOT NULL,
	"text" text NOT NULL,
	"node_id" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "log_entries_brain_id_seq_pk" PRIMARY KEY("brain_id","seq")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"brain_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"user_note" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"parent_id" text,
	"depth" integer NOT NULL,
	"color" text NOT NULL,
	"by" text,
	"critic" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "nodes_brain_id_id_pk" PRIMARY KEY("brain_id","id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brains" ADD CONSTRAINT "brains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_brain_id_brains_id_fk" FOREIGN KEY ("brain_id") REFERENCES "public"."brains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_brain_id_brains_id_fk" FOREIGN KEY ("brain_id") REFERENCES "public"."brains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_brain_id_brains_id_fk" FOREIGN KEY ("brain_id") REFERENCES "public"."brains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brains_user_idx" ON "brains" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nodes_brain_parent_idx" ON "nodes" USING btree ("brain_id","parent_id");