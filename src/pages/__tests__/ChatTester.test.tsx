import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ChatTester } from '../ChatTester';
import * as chatTesterService from '../../services/chatTester';
import * as tauriUtils from '../../utils/tauri';

// Mock services
vi.mock('../../services/chatTester', () => ({
  fetchChatModels: vi.fn(),
  sendChatCompletion: vi.fn(),
  getProxyEndpoint: vi.fn(),
}));

vi.mock('../../utils/tauri', () => ({
  extractCliError: vi.fn(),
}));

// Mock fetch globally
globalThis.fetch = vi.fn();

describe('ChatTester', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderChatTester = () => {
    return render(
      <BrowserRouter>
        <ChatTester />
      </BrowserRouter>
    );
  };

  it('should render chat tester page', async () => {
    vi.mocked(chatTesterService.getProxyEndpoint).mockResolvedValue(
      'http://localhost:8080'
    );
    vi.mocked(chatTesterService.fetchChatModels).mockResolvedValue([
      {
        id: 'gpt-4',
        flmUri: 'gpt-4',
        displayName: 'GPT-4',
      },
    ]);

    renderChatTester();

    await waitFor(() => {
      expect(screen.getByText(/Chat Tester/i)).toBeInTheDocument();
    });
  });

  it('should display error when proxy is not running', async () => {
    vi.mocked(chatTesterService.getProxyEndpoint).mockResolvedValue(null);

    renderChatTester();

    await waitFor(
      () => {
        expect(
          screen.getByText(/プロキシが実行されていません/i)
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('should load and display models when proxy is running', async () => {
    const mockModels = [
      {
        id: 'gpt-4',
        flmUri: 'gpt-4',
        displayName: 'GPT-4',
      },
      {
        id: 'flm-ollama-llama2',
        flmUri: 'flm://ollama/llama2',
        displayName: 'flm://ollama/llama2',
      },
    ];

    vi.mocked(chatTesterService.getProxyEndpoint).mockResolvedValue(
      'http://localhost:8080'
    );
    vi.mocked(chatTesterService.fetchChatModels).mockResolvedValue(mockModels);

    renderChatTester();

    await waitFor(() => {
      expect(chatTesterService.fetchChatModels).toHaveBeenCalledWith(
        'http://localhost:8080'
      );
    });
  });

  it('should display error when model loading fails', async () => {
    vi.mocked(chatTesterService.getProxyEndpoint).mockResolvedValue(
      'http://localhost:8080'
    );
    vi.mocked(chatTesterService.fetchChatModels).mockRejectedValue(
      new Error('Failed to fetch models')
    );
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(null);

    renderChatTester();

    await waitFor(
      () => {
        // Errorオブジェクトの場合はerr.messageが使用される
        expect(screen.getByText(/Failed to fetch models/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('should allow user to enter message', async () => {
    const user = userEvent.setup();
    vi.mocked(chatTesterService.getProxyEndpoint).mockResolvedValue(
      'http://localhost:8080'
    );
    vi.mocked(chatTesterService.fetchChatModels).mockResolvedValue([
      {
        id: 'gpt-4',
        flmUri: 'gpt-4',
        displayName: 'GPT-4',
      },
    ]);

    renderChatTester();

    await waitFor(() => {
      expect(chatTesterService.fetchChatModels).toHaveBeenCalled();
    });

    const messageInput = screen.getByPlaceholderText(/メッセージを入力/i);
    await user.type(messageInput, 'Hello, world!');

    expect(messageInput).toHaveValue('Hello, world!');
  });

  it('should send chat completion when form is submitted', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?',
          },
          finish_reason: 'stop',
        },
      ],
    };

    vi.mocked(chatTesterService.getProxyEndpoint).mockResolvedValue(
      'http://localhost:8080'
    );
    vi.mocked(chatTesterService.fetchChatModels).mockResolvedValue([
      {
        id: 'gpt-4',
        flmUri: 'gpt-4',
        displayName: 'GPT-4',
      },
    ]);
    vi.mocked(chatTesterService.sendChatCompletion).mockResolvedValue(
      mockResponse
    );

    renderChatTester();

    await waitFor(() => {
      expect(chatTesterService.fetchChatModels).toHaveBeenCalled();
    });

    const messageInput = screen.getByPlaceholderText(/メッセージを入力/i);
    await user.type(messageInput, 'Hello');

    const sendButton = screen.getByRole('button', { name: /送信/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(chatTesterService.sendChatCompletion).toHaveBeenCalled();
    });
  });
});
