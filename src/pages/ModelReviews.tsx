// ModelReviews - モデルレビューページ
// モデルの評価・レビュー機能

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './ModelReviews.css';

/**
 * モデルレビュー情報
 */
interface ModelReview {
  id: string;
  model_name: string;
  user_id: string;
  rating: number;
  review_text?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * モデルレビュー統計情報
 */
interface ModelReviewStats {
  model_name: string;
  average_rating: number;
  total_reviews: number;
  rating_distribution: number[];
}

/**
 * モデルレビューページ
 */
export const ModelReviews: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [reviews, setReviews] = useState<ModelReview[]>([]);
  const [stats, setStats] = useState<ModelReviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  useEffect(() => {
    if (selectedModel) {
      loadReviews();
      loadStats();
    }
  }, [selectedModel]);

  /**
   * レビュー一覧を読み込む
   */
  const loadReviews = async () => {
    if (!selectedModel) return;

    try {
      setLoading(true);
      
      // レビュー一覧を取得
      const reviewsData = await safeInvoke<ModelReview[]>('get_model_reviews', {
        model_name: selectedModel,
        limit: 50,
        offset: 0,
      });
      setReviews(reviewsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'レビューの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 統計情報を読み込む
   */
  const loadStats = async () => {
    if (!selectedModel) return;

    try {
      const reviewStats = await safeInvoke<ModelReviewStats>('get_model_review_stats', {
        model_name: selectedModel,
      });
      setStats(reviewStats);
    } catch (err) {
      // エラーは無視
      setStats(null);
    }
  };

  /**
   * レビューを追加
   */
  const handleAddReview = async () => {
    if (!selectedModel) {
      showError('モデルを選択してください');
      return;
    }

    try {
      setSaving(true);
      
      // 現在のユーザーID（マルチユーザー機能が実装されていないため、固定値を使用）
      // 将来の実装では、認証システムから現在のユーザーIDを取得
      const currentUserId = 'user-1';
      
      await safeInvoke('add_model_review', {
        model_name: selectedModel,
        user_id: currentUserId,
        rating: newRating,
        review_text: newReviewText.trim() || null,
        tags: newTags,
      });

      showSuccess('レビューを追加しました');
      setNewRating(5);
      setNewReviewText('');
      setNewTags([]);
      setShowReviewForm(false);
      loadReviews();
      loadStats();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'レビューの追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 評価を星表示に変換
   */
  const renderStars = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="model-reviews-page">
      <div className="model-reviews-container">
        <header className="model-reviews-header">
          <button className="back-button" onClick={() => navigate('/models')}>
            ← 戻る
          </button>
          <h1>モデルレビュー</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="model-reviews-content">
          <div className="model-reviews-info-banner">
            <h2>モデル評価・レビュー機能</h2>
            <p>
              モデルの評価とレビューを共有できます。モデルの評価を追加し、他のユーザーと評価情報を共有できます。
            </p>
          </div>

          <div className="model-selector">
            <label className="form-label" htmlFor="model-select">
              モデルを選択
            </label>
            <input
              id="model-select"
              type="text"
              className="form-input"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="モデル名を入力（例: llama3.2）"
            />
          </div>

          {selectedModel && (
            <>
              {stats && (
                <div className="review-stats">
                  <h3>統計情報</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-label">平均評価</span>
                      <span className="stat-value">
                        {stats.average_rating.toFixed(1)} / 5.0
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">レビュー数</span>
                      <span className="stat-value">{stats.total_reviews}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="reviews-section">
                <div className="reviews-header">
                  <h2>レビュー一覧</h2>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    disabled={saving}
                  >
                    {showReviewForm ? 'キャンセル' : '+ レビューを書く'}
                  </button>
                </div>

                {showReviewForm && (
                  <div className="review-form">
                    <div className="form-group">
                      <label className="form-label">評価</label>
                      <div className="rating-input">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            className={`rating-button ${newRating >= rating ? 'active' : ''}`}
                            onClick={() => setNewRating(rating)}
                            disabled={saving}
                          >
                            ★
                          </button>
                        ))}
                        <span className="rating-display">{newRating} / 5</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="review-text">
                        レビュー本文
                      </label>
                      <textarea
                        id="review-text"
                        className="form-textarea"
                        value={newReviewText}
                        onChange={(e) => setNewReviewText(e.target.value)}
                        placeholder="レビューを入力（オプション）"
                        rows={5}
                        disabled={saving}
                      />
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          setShowReviewForm(false);
                          setNewRating(5);
                          setNewReviewText('');
                          setNewTags([]);
                        }}
                        disabled={saving}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={handleAddReview}
                        disabled={saving}
                      >
                        {saving ? '送信中...' : 'レビューを投稿'}
                      </button>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="reviews-loading">
                    <p>レビューを読み込んでいます...</p>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="reviews-empty">
                    <p>レビューがまだありません</p>
                    <p className="reviews-empty-hint">
                      最初のレビューを投稿しましょう。
                    </p>
                  </div>
                ) : (
                  <div className="reviews-list">
                    {reviews.map((review) => (
                      <div key={review.id} className="review-item">
                        <div className="review-header">
                          <div className="review-rating">
                            {renderStars(review.rating)}
                          </div>
                          <span className="review-date">
                            {new Date(review.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        {review.review_text && (
                          <p className="review-text">{review.review_text}</p>
                        )}
                        {review.tags.length > 0 && (
                          <div className="review-tags">
                            {review.tags.map((tag, index) => (
                              <span key={index} className="review-tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

