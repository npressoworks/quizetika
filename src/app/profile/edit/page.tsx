'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { 
  getUser, 
  updateProfile, 
  validateProfileData, 
  ProfileValidationError 
} from '@/services/user';
import { Header } from '@/components/layout/header';
import { AlertCircle, Save, ArrowLeft } from 'lucide-react';
import styles from './edit.module.css';

export default function ProfileEditPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ProfileValidationError[]>([]);
  const [submitError, setSubmitError] = useState('');

  // 現在のユーザー情報を取得してフォームにセット
  useEffect(() => {
    async function loadUserData() {
      if (authLoading) return;
      if (!currentUser) {
        router.push('/login');
        return;
      }
      try {
        const userData = await getUser(currentUser.id);
        if (userData) {
          setDisplayName(userData.displayName || '');
          setBio(userData.bio || '');
        }
      } catch (err) {
        console.error('Failed to load user profile for editing:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [currentUser, authLoading, router]);

  // 入力値変更時のリアルタイムバリデーション
  useEffect(() => {
    if (loading) return;
    const validationErrors = validateProfileData({ displayName, bio });
    setErrors(validationErrors);
  }, [displayName, bio, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || errors.length > 0 || submitting) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      await updateProfile(currentUser.id, { displayName, bio });
      router.push(`/profile/${currentUser.id}`);
    } catch (err: any) {
      console.error('Profile update failed:', err);
      setSubmitError(err.message || '更新に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldError = (field: 'displayName' | 'bio') => {
    return errors.find(err => err.field === field)?.message;
  };

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const hasErrors = errors.length > 0;

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Back link */}
          <button 
            onClick={() => router.push(`/profile/${currentUser?.id}`)} 
            className={styles.backButton}
          >
            <ArrowLeft size={16} />
            <span>プロフィールに戻る</span>
          </button>

          {/* Edit Card */}
          <div className={`${styles.editCard} glass-card animate-fade-in`}>
            <h1 className={styles.title}>プロフィールの編集</h1>
            
            {submitError && (
              <div className={styles.errorAlert}>
                <AlertCircle size={18} />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              {/* Display Name Input */}
              <div className="form-group">
                <label className="form-label" htmlFor="displayName">表示名</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`form-input ${getFieldError('displayName') ? styles.inputError : ''}`}
                  placeholder="ユーザー名を入力してください"
                  disabled={submitting}
                />
                <div className={styles.inputFooter}>
                  {getFieldError('displayName') ? (
                    <span className={styles.errorText}>{getFieldError('displayName')}</span>
                  ) : (
                    <span />
                  )}
                  <span className={`${styles.charCount} ${displayName.length > 30 ? styles.countOver : ''}`}>
                    {displayName.length} / 30
                  </span>
                </div>
              </div>

              {/* Biography TextArea */}
              <div className="form-group">
                <label className="form-label" htmlFor="bio">自己紹介</label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`form-input ${styles.textarea} ${getFieldError('bio') ? styles.inputError : ''}`}
                  placeholder="自己紹介を書いてみましょう（好きなジャンルや関心など）"
                  disabled={submitting}
                  rows={5}
                />
                <div className={styles.inputFooter}>
                  {getFieldError('bio') ? (
                    <span className={styles.errorText}>{getFieldError('bio')}</span>
                  ) : (
                    <span />
                  )}
                  <span className={`${styles.charCount} ${bio.length > 200 ? styles.countOver : ''}`}>
                    {bio.length} / 200
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${currentUser?.id}`)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${hasErrors || submitting ? 'btn-disabled' : ''}`}
                  disabled={hasErrors || submitting}
                >
                  <Save size={18} />
                  <span>{submitting ? '保存中...' : '変更を保存する'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
