export type User = {
    avatar_url?: string
    login: string
    name?: string
    bio?: string
}

export type SearchUser = Pick<User, 'login' | 'avatar_url'>