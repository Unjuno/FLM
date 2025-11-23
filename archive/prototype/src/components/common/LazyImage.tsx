// LazyImage - 遅延読み込み対応画像コンポーネント

import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  fallback?: string;
  onError?: () => void;
}

/**
 * 遅延読み込み対応画像コンポーネント
 * Intersection Observer APIを使用して、画像が表示領域に入ったときに読み込みます
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  fallback,
  onError,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const styleRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Intersection Observerが利用可能かチェック
    if (!('IntersectionObserver' in window)) {
      // フォールバック: 即座に読み込み
      setImageSrc(src);
      return;
    }

    const imgElement = imgRef.current;
    if (!imgElement) return;

    // Intersection Observerを作成
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // 画像が表示領域に入ったら読み込み
            setImageSrc(src);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // 表示領域の50px手前から読み込み開始
      }
    );

    observerRef.current.observe(imgElement);

    // クリーンアップ
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    if (fallback) {
      setImageSrc(fallback);
    }
    if (onError) {
      onError();
    }
  };

  // CSS変数を設定（監査レポートの推奨事項に基づき追加）
  useEffect(() => {
    if (styleRef.current) {
      styleRef.current.style.setProperty(
        '--lazy-image-opacity',
        isLoaded ? '1' : '0.5'
      );
      styleRef.current.style.setProperty(
        '--lazy-image-transition',
        'opacity 0.3s ease-in-out'
      );
    }
  }, [isLoaded]);

  // refコールバックで両方のrefを設定
  const setRefs = (el: HTMLImageElement | null) => {
    imgRef.current = el;
    styleRef.current = el;
  };

  return (
    <img
      ref={setRefs}
      src={imageSrc}
      alt={alt}
      onLoad={handleLoad}
      onError={handleError}
      className="lazy-image"
      {...props}
    />
  );
};
