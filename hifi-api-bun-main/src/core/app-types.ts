import type { HifiClient } from "../hifi/client";
import type { AuthService } from "../auth/service";

export type BaseServices = {
  hifiClient: HifiClient
}

export type AuthServices = BaseServices & {
  authService: AuthService
}

export type BaseDecorators = {
  services: BaseServices
}

export type AuthDecorators = {
  services: AuthServices
}

export type BaseSingleton = {
  decorator: BaseDecorators
  store: {}
  derive: {}
  resolve: {}
}

export type AuthSingleton = {
  decorator: AuthDecorators
  store: {}
  derive: {}
  resolve: {}
}