// FLM - お問い合わせフォーム機能
// フォームバリデーションと送信処理

/**
 * お問い合わせフォームの初期化
 */
document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  initFormValidation(form);
  initFormSubmit(form);
});

/**
 * フォームバリデーションの初期化
 */
function initFormValidation(form) {
  const nameInput = form.querySelector('#name');
  const emailInput = form.querySelector('#email');
  const subjectInput = form.querySelector('#subject');
  const categorySelect = form.querySelector('#category');
  const messageTextarea = form.querySelector('#message');

  // リアルタイムバリデーション
  if (nameInput) {
    nameInput.addEventListener('blur', () => validateName(nameInput));
  }

  if (emailInput) {
    emailInput.addEventListener('blur', () => validateEmail(emailInput));
  }

  if (subjectInput) {
    subjectInput.addEventListener('blur', () => validateSubject(subjectInput));
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => validateCategory(categorySelect));
  }

  if (messageTextarea) {
    messageTextarea.addEventListener('blur', () => validateMessage(messageTextarea));
  }
}

/**
 * フォーム送信の初期化
 */
function initFormSubmit(form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (validateForm(form)) {
      // 確認ダイアログ
      if (confirm('この内容で送信してもよろしいですか？')) {
        handleFormSubmit(form);
      }
    } else {
      // 最初のエラー要素にフォーカス
      const firstError = form.querySelector('.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
}

/**
 * フォーム全体のバリデーション
 */
function validateForm(form) {
  let isValid = true;

  const nameInput = form.querySelector('#name');
  const emailInput = form.querySelector('#email');
  const subjectInput = form.querySelector('#subject');
  const categorySelect = form.querySelector('#category');
  const messageTextarea = form.querySelector('#message');

  // すべてのエラーメッセージをクリア
  clearErrors(form);

  // 各フィールドをバリデーション
  if (nameInput && !validateName(nameInput)) isValid = false;
  if (emailInput && !validateEmail(emailInput)) isValid = false;
  if (subjectInput && !validateSubject(subjectInput)) isValid = false;
  if (categorySelect && !validateCategory(categorySelect)) isValid = false;
  if (messageTextarea && !validateMessage(messageTextarea)) isValid = false;

  return isValid;
}

/**
 * 名前のバリデーション
 */
function validateName(input) {
  const value = input.value.trim();
  
  if (!value) {
    showError(input, '名前を入力してください');
    return false;
  }
  
  if (value.length < 2) {
    showError(input, '名前は2文字以上で入力してください');
    return false;
  }
  
  clearError(input);
  return true;
}

/**
 * メールアドレスのバリデーション
 */
function validateEmail(input) {
  const value = input.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!value) {
    showError(input, 'メールアドレスを入力してください');
    return false;
  }
  
  if (!emailRegex.test(value)) {
    showError(input, '有効なメールアドレスを入力してください');
    return false;
  }
  
  clearError(input);
  return true;
}

/**
 * 件名のバリデーション
 */
function validateSubject(input) {
  const value = input.value.trim();
  
  if (!value) {
    showError(input, '件名を入力してください');
    return false;
  }
  
  if (value.length < 5) {
    showError(input, '件名は5文字以上で入力してください');
    return false;
  }
  
  clearError(input);
  return true;
}

/**
 * カテゴリーのバリデーション
 */
function validateCategory(select) {
  const value = select.value;
  
  if (!value || value === '') {
    showError(select, 'カテゴリーを選択してください');
    return false;
  }
  
  clearError(select);
  return true;
}

/**
 * メッセージのバリデーション
 */
function validateMessage(textarea) {
  const value = textarea.value.trim();
  
  if (!value) {
    showError(textarea, 'メッセージを入力してください');
    return false;
  }
  
  if (value.length < 10) {
    showError(textarea, 'メッセージは10文字以上で入力してください');
    return false;
  }
  
  clearError(textarea);
  return true;
}

/**
 * エラー表示
 */
function showError(input, message) {
  clearError(input);
  
  input.classList.add('error');
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  
  input.parentNode.insertBefore(errorDiv, input.nextSibling);
}

/**
 * エラークリア
 */
function clearError(input) {
  input.classList.remove('error');
  
  const errorDiv = input.parentNode.querySelector('.error-message');
  if (errorDiv) {
    errorDiv.remove();
  }
}

/**
 * すべてのエラーをクリア
 */
function clearErrors(form) {
  const errors = form.querySelectorAll('.error-message');
  errors.forEach(error => error.remove());
  
  const errorInputs = form.querySelectorAll('.error');
  errorInputs.forEach(input => input.classList.remove('error'));
}

/**
 * フォーム送信処理
 */
function handleFormSubmit(form) {
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  
  // 送信ボタンを無効化
  submitButton.disabled = true;
  submitButton.textContent = '送信中...';
  
  // フォームデータを取得
  const formData = new FormData(form);
  const data = {
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    category: formData.get('category'),
    message: formData.get('message'),
  };
  
  // 実際の送信処理（現時点ではフロントエンドのみ）
  // 将来的には、ここでサーバーに送信するか、Formspree等のサービスを使用
  setTimeout(() => {
    // 成功メッセージを表示
    showSuccessMessage(form);
    
    // フォームをリセット
    form.reset();
    
    // 送信ボタンを有効化
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }, 1000);
}

/**
 * 成功メッセージを表示
 */
function showSuccessMessage(form) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.innerHTML = `
    <div style="background-color: var(--success-color); color: white; padding: 1rem; border-radius: var(--border-radius); margin-top: 1rem;">
      <strong>✓ 送信完了</strong><br>
      お問い合わせありがとうございました。担当者より連絡いたします。
    </div>
  `;
  
  form.parentNode.insertBefore(successDiv, form.nextSibling);
  
  // 3秒後に自動で削除
  setTimeout(() => {
    successDiv.remove();
  }, 5000);
}

