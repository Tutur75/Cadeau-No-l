import audreyAvatar from './images/audrey_avatar.jpg';
import arthurAvatar from './images/arthur_avatar.jpg';
import zoeAvatar from './images/zoe_photo.jpeg';
import { FamilyMember } from '../types';

export const MEMBER_AVATARS: Record<FamilyMember, string> = {
  Audrey: audreyAvatar,
  Arthur: arthurAvatar,
  Zoé: zoeAvatar,
};

export { audreyAvatar, arthurAvatar, zoeAvatar };
