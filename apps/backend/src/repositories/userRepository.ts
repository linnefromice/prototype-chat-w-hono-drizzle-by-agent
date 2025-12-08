import type { User } from 'openapi'

export interface UserRepository {
  create(data: { name: string; avatarUrl?: string | null }): Promise<User>
  findById(id: string): Promise<User | null>
  listAll(): Promise<User[]>
}
