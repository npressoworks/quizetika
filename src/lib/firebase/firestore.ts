import { db } from './config';
import { collection } from 'firebase/firestore';

export const usersRef = collection(db, 'users') as any;
export const quizzesRef = collection(db, 'quizzes') as any;
