import { IsIn } from 'class-validator';

export class VoteDto {
  @IsIn(['upvote', 'downvote'], { message: 'vote must be "upvote" or "downvote"' })
  vote!: 'upvote' | 'downvote';
}
