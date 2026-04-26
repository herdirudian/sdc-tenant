declare module "next" {
  export type Metadata = unknown;
}

declare module "next/cache" {
  export function revalidatePath(
    path: string,
    type?: "layout" | "page",
  ): void;
}

declare module "next/navigation" {
  export function redirect(url: string): never;
  export function notFound(): never;
}

declare module "next/link" {
  import * as React from "react";
  const Link: React.ComponentType<any>;
  export default Link;
}

declare module "next/image" {
  import * as React from "react";
  const Image: React.ComponentType<any>;
  export default Image;
}

declare module "next/font/google" {
  export function Geist(options: any): any;
  export function Geist_Mono(options: any): any;
}

declare module "next/headers" {
  export function cookies(): Promise<any>;
  export function headers(): Promise<any>;
}

declare module "next/server" {
  export class NextResponse {
    static next(): any;
    static redirect(url: URL): any;
    cookies: any;
  }

  export interface NextRequest {
    nextUrl: { pathname: string };
    url: string;
    cookies: any;
  }
}
