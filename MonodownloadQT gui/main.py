from __future__ import annotations

import shutil
import sys
import re
import urllib.request
import urllib.parse
import json
import io
from pathlib import Path

from PyQt6.QtCore import QProcess, QProcessEnvironment, QSettings, QSize, QTimer, QThread
from PyQt6.QtGui import QIcon, QPixmap, QImage, QTextCursor, QTextOption
from PyQt6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QLineEdit,
    QScrollArea,
    QStackedWidget,
    QTabWidget,
    QProgressBar,
    QPushButton,
    QSizePolicy,
    QSpinBox,
    QStyleFactory,
    QTextEdit,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

ROOT_DIR = Path(__file__).resolve().parent
MONODOWNLOAD_DIR = (ROOT_DIR.parent / "monodownload").resolve()
SCRIPT_PATH = MONODOWNLOAD_DIR / "index.mjs"
ARTIST_API_KEYS_PATH = ROOT_DIR / ".api-keys.json"

STRINGS = {
    "ru": {
        "app_title": "Monodownload",
        "source": "Источник",
        "source_label": "Источник:",
        "source_ph": "URL или путь к CSV / JSON / TXT…",
        "output": "Папка вывода:",
        "output_label": "Папка вывода:",
        "output_ph": "необязательно",
        "output_ph_alt": "необязательно",
        "parameters": "Параметры",
        "api_url": "API URL:",
        "api_url_label": "API URL:",
        "api_url_ph": "https://…  (необязательно)",
        "flags": "Флаги",
        "quality": "Качество:",
        "quality_ph": "HI_RES_LOSSLESS",
        "quality_hi_res": "Hi-Res Lossless (24-bit FLAC)",
        "quality_lossless": "Lossless (16-bit FLAC)",
        "quality_low": "Low (HE-AAC)",
        "no_lyrics": "Без текста (.lrc)",
        "no_genres": "Без жанров",
        "no_bpm": "Без BPM",
        "no_zip": "Без ZIP",
        "artist_folders": "Папки исполнителя",
        "skip_preflight": "Без проверки воспроизведения",
        "lyrics_providers": "Провайдеры текстов",
        "lrclib_label": "LRCLIB (бесплатный)",
        "genius_label": "Genius (требуется API ключ)",
        "lyrics_prefs": "Настройки:",
        "synced_only": "Только синхронные тексты (LRC)",
        "no_artist": "Не включать исполнителя в поиск",
        "genius_api_key": "Genius API ключ:",
        "lastfm_api_key": "Last.fm API ключ:",
        "genre_providers": "Провайдеры жанров",
        "lastfm_label": "Last.fm",
        "musicbrainz_label": "MusicBrainz",
        "lastfm_rate": "Лимит: ~5 req/sec avg over 5 min",
        "musicbrainz_rate": "Лимит: 1 req/sec per IP",
        "command": "Команда",
        "log": "Журнал",
        "start": "Запустить",
        "cancel": "Остановить",
        "show_log": "Показать журнал",
        "browse_file": "Выбрать файл…",
        "browse_folder": "Выбрать папку…",
        "clear_log": "Очистить журнал",
        "paste_tooltip": "Вставить из буфера обмена",
        "downloading": "Загрузка",
        "completed": "Завершено",
        "active_download_title": "Загрузка активна",
        "active_download_msg": "Загрузка ещё идёт. Остановить и выйти?",
        "failed_to_start": "Не удалось запустить процесс.",
        "already_running_title": "Уже запущено",
        "already_running_msg": "Загрузка уже идёт. Дождитесь завершения или остановите её.",
        "error_title": "Ошибка",
        "script_not_found": "Файл сценария не найден:",
        "empty_source_warning": "Укажите источник и убедитесь, что bun или node доступны в PATH.",
        "output_ph_alt": "необязательно",
        "username": "Пользователь:",
        "login_key": "Ключ входа:",
        "password": "Пароль:",
        "main_tab": "Главная",
        "settings_tab": "Настройки",
        "auto_restart": "Авто-перезапуск:",
        "max_concurrent": "Макс параллельных:",
        "max_concurrent_warning": "Предупреждение: Больше 1 может вызвать блокировку API",
        "timeout": "Таймаут (секунды):",
        "timeout_warning": "Таймаут запроса в секундах",
        "queue_label": "Очередь:",
        "show_log": "Показать журнал",
        "language": "Язык:",
        "add_to_queue_tooltip": "Добавить в очередь",
        "quality_help_tooltip": "Качество может упасть до ниже если недоступно (24-bit FLAC -> 16-bit FLAC -> AAC -> HE-AAC)",
        "hide_command": "Скрыть поле команды",
        "search": "Поиск",
        "search_dialog_title": "Поиск треков",
        "search_placeholder": "Введите трек, исполнителя или альбом...",
        "search_btn": "Найти",
        "search_results": "Результаты поиска",
        "tracks": "Треки",
        "artists": "Исполнители",
        "back": "Назад",
        "forward": "Вперёд",
        "up": "Вверх",
        "album_types": "Типы релизов",
        "albums": "Альбомы",
        "eps": "EP/Синглы",
        "fetch_source_error": "Не удалось получить информацию об источнике",
        "config_edit": "Редактировать конфиги",
        "config_editor_title": "Редактор конфигов",
        "config_api_keys": "API ключи (api-keys.json)",
        "config_save": "Сохранить",
        "config_saved": "Конфиг сохранён",
        },
    "en": {
        "app_title": "Monodownload",
        "source": "Source",
        "source_label": "Source:",
        "source_ph": "URL or path to CSV / JSON / TXT…",
        "output": "Output folder:",
        "output_label": "Output folder:",
        "output_ph": "(optional)",
        "output_ph_alt": "(optional)",
        "parameters": "Parameters",
        "api_url": "API URL:",
        "api_url_ph": "https://…  (optional)",
        "quality": "Quality:",
        "quality_ph": "HI_RES_LOSSLESS",
        "retries": "Retries:",
        "quality_hi_res": "Hi-Res Lossless (24-bit FLAC)",
        "quality_lossless": "Lossless (16-bit FLAC)",
        "quality_low": "Low (HE-AAC)",
        "auth": "Authorization",
        "username": "Username:",
        "login_key": "Login key:",
        "password": "Password:",
        "flags": "Flags",
        "no_lyrics": "No lyrics (.lrc)",
        "no_genres": "No genres",
        "no_bpm": "No BPM",
        "no_zip": "No ZIP",
        "artist_folders": "Artist folders",
        "skip_preflight": "Skip playback check",
        "lyrics_providers": "Lyrics providers",
        "lrclib_label": "LRCLIB (free)",
        "genius_label": "Genius (needs API key)",
        "lyrics_prefs": "Preferences:",
        "synced_only": "Only synced (LRC) lyrics",
        "no_artist": "Don't include artist in search",
        "genius_api_key": "Genius API key:",
        "lastfm_api_key": "Last.fm API key:",
        "genre_providers": "Genre providers",
        "lastfm_label": "Last.fm",
        "musicbrainz_label": "MusicBrainz",
        "lastfm_rate": "Rate limit: ~5 req/sec avg over 5 min",
        "musicbrainz_rate": "Rate limit: 1 req/sec per IP",
        "command": "Command",
        "log": "Log",
        "start": "Start",
        "cancel": "Stop",
        "show_log": "Show log",
        "browse_file": "Browse file…",
        "browse_folder": "Browse folder…",
        "clear_log": "Clear log",
        "paste_tooltip": "Paste from clipboard",
        "downloading": "Downloading",
        "completed": "Completed",
        "active_download_title": "Download active",
        "active_download_msg": "Download still in progress. Stop and exit?",
        "failed_to_start": "Failed to start process.",
        "already_running_title": "Already running",
        "already_running_msg": "Download already in progress. Wait for completion or stop it.",
        "error_title": "Error",
        "script_not_found": "Script file not found:",
        "empty_source_warning": "Enter a source and ensure bun or node is available in PATH.",
        "main_tab": "Main",
        "settings_tab": "Settings",
        "auto_restart": "Auto-restart:",
        "max_concurrent": "Max concurrent:",
        "max_concurrent_warning": "Warning: More than 1 may cause API rate limit bans",
        "timeout": "Timeout (seconds):",
        "timeout_warning": "Request timeout in seconds",
        "queue_label": "Queue:",
        "show_log": "Show log",
        "language": "Language:",
        "add_to_queue_tooltip": "Add to queue",
        "quality_help_tooltip": "Quality may fall back to lower if unavailable (24-bit FLAC -> 16-bit FLAC -> AAC -> HE-AAC)",
        "hide_command": "Hide command box",
        "search": "Search",
        "search_dialog_title": "Search Tracks",
        "search_placeholder": "Enter track, artist, or album...",
        "search_btn": "Search",
        "search_results": "Search Results",
        "tracks": "Tracks",
        "artists": "Artists",
        "back": "Back",
        "forward": "Forward",
        "up": "Up",
        "album_types": "Album Types",
        "albums": "Albums",
        "eps": "EPs/Singles",
        "fetch_source_error": "Failed to fetch source info",
        "config_edit": "Edit Config Files",
        "config_editor_title": "Config Editor",
        "config_api_keys": "API Keys (api-keys.json)",
        "config_save": "Save",
        "config_saved": "Config saved",
        },
    }


def apply_style(app: QApplication) -> None:
    keys = [k.lower() for k in QStyleFactory.keys()]
    app.setStyle("Breeze" if "breeze" in keys else "Fusion")
    app.setDesktopSettingsAware(True)


def _icon(name: str) -> QIcon:
    """Return a themed icon, falls back to empty icon gracefully."""
    return QIcon.fromTheme(name)


class MonodownloadGui(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Monodownload")
        self.setWindowIcon(_icon("arrow-down"))
        self.setMinimumSize(900, 700)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

        self.process = QProcess(self)
        self.process.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        self.process.readyReadStandardOutput.connect(self._on_output)
        self.process.readyReadStandardError.connect(self._on_output)
        self.process.finished.connect(self._on_finished)

        self.current_track_label = ""
        self.total_tracks = 0
        self.current_track_index = 0
        self._completed_status = ""
        self._current_lang = "en"
        self._last_progress_percent = -1
        self._download_queue = []
        self._current_source = ""
        self._restart_count = 0
        self._max_restarts = 3
        self._cancelled = False
        self._max_concurrent_label = None
        self._timeout_warning_label = None
        self._timeout_label = None
        self._language_label = None
        self._source_label_widget = None
        self._queue_label_widget = None
        self._output_label_widget = None
        self._quality_label_widget = None
        self._api_url_label_widget = None
        self._username_label_widget = None
        self._login_key_label_widget = None
        self._lastfm_label_widget = None
        self._password_label_widget = None
        self._hide_command = False
        self._total_tracks = 0
        self._completed_tracks = 0
        self._failed_tracks = 0
        self._queue_completed = 0
        self._queue_total = 0
        self._current_album = ""
        self._download_speed = ""
        self._source_info_label = None
        self.genre_providers = ["musicbrainz", "lastfm"]
        self.lyrics_providers = ["lrclib"]
        self.lastfm_api_key = ""
        self.synced_only = False
        self.lyrics_no_artist = False
        self.genius_api_key = ""

        self._build_widgets()
        self._build_ui()
        self._connect_signals()

        self.settings = QSettings("MonodownloadQT", "MonodownloadQT-GUI")
        self._load_settings()
        
        self._current_lang = self.settings.value("language", "en", type=str)
        for i in range(self.language_combo.count()):
            if self.language_combo.itemData(i) == self._current_lang:
                self.language_combo.setCurrentIndex(i)
                break
        self._apply_language(self._current_lang)
        
        show_log = self.settings.value("show_log", True, type=bool)
        self.show_log_check.setChecked(show_log)
        self.log_group.setVisible(show_log)
        
        self._load_api_keys_from_file()
        self._refresh_preview()

    def _build_widgets(self) -> None:
        self.input_edit = QLineEdit()
        self.input_edit.setPlaceholderText(STRINGS["en"]["source_ph"])
        self.input_edit.setClearButtonEnabled(True)

        self.add_to_queue_btn = QToolButton()
        self.add_to_queue_btn.setIcon(_icon("list-add"))
        self.add_to_queue_btn.setToolTip(STRINGS["en"]["add_to_queue_tooltip"])
        self.add_to_queue_btn.setText("+")
        self.add_to_queue_btn.setIconSize(QSize(18, 18))

        self.queue_list = QListWidget()
        self.queue_list.setMaximumHeight(120)
        self.queue_list.setStyleSheet("font-family: monospace; font-size: 11px;")

        self.paste_btn = QToolButton()
        self.paste_btn.setIcon(_icon("edit-paste"))
        self.paste_btn.setToolTip(STRINGS["en"]["paste_tooltip"])
        self.paste_btn.setIconSize(QSize(18, 18))
        self.paste_btn.clicked.connect(
            lambda: self.input_edit.setText(QApplication.clipboard().text().strip())
        )

        self.output_edit = QLineEdit(str(MONODOWNLOAD_DIR / "downloads"))

        self.api_url_edit = QLineEdit()
        self.api_url_edit.setPlaceholderText(STRINGS["en"]["api_url_ph"])
        self.api_url_edit.setClearButtonEnabled(True)

        self.quality_combo = QComboBox()
        self.quality_combo.addItem(STRINGS["en"]["quality_hi_res"], "HI_RES_LOSSLESS")
        self.quality_combo.addItem(STRINGS["en"]["quality_lossless"], "LOSSLESS")
        self.quality_combo.addItem(STRINGS["en"]["quality_low"], "LOW")
        self.quality_combo.setCurrentIndex(0)
        
        self.quality_help_btn = QToolButton()
        self.quality_help_btn.setText("?")
        self.quality_help_btn.setToolTip(STRINGS["en"]["quality_help_tooltip"])
        self.quality_help_btn.setFixedSize(22, 22)
        self.quality_help_btn.setEnabled(False)
        
        self.search_btn = QToolButton()
        self.search_btn.setIcon(_icon("system-search"))
        self.search_btn.setText(STRINGS["en"].get("search", "Search"))
        self.search_btn.setToolTip(STRINGS["en"].get("search_dialog_title", "Search tracks"))
        self.search_btn.setFixedSize(30, 22)

        self.retries_spin = QSpinBox()
        self.retries_spin.setRange(0, 10)
        self.retries_spin.setValue(2)

        self.username_edit = QLineEdit()
        self.username_edit.setPlaceholderText(STRINGS["en"]["output_ph_alt"])
        self.username_edit.setClearButtonEnabled(True)
        
        self.login_key_edit = QLineEdit()
        self.login_key_edit.setPlaceholderText(STRINGS["en"]["output_ph_alt"])
        self.login_key_edit.setClearButtonEnabled(True)
        
        self.password_edit = QLineEdit()
        self.password_edit.setPlaceholderText(STRINGS["en"]["output_ph_alt"])
        self.password_edit.setEchoMode(QLineEdit.EchoMode.Password)

        self.no_lyrics_check = QCheckBox("Без текста (.lrc)")
        self.lyrics_providers_btn = QToolButton()
        self.lyrics_providers_btn.setText("…")
        self.lyrics_providers_btn.setToolTip("Настройки провайдеров текстов")
        self.no_genres_check = QCheckBox("Без жанров")
        self.genre_providers_btn = QToolButton()
        self.genre_providers_btn.setText("…")
        self.genre_providers_btn.setToolTip("Настройки провайдеров жанров")
        self.no_bpm_check = QCheckBox("Без BPM")
        self.no_zip_check = QCheckBox("Без ZIP")
        self.artist_folders_check = QCheckBox("Папки исполнителя")
        self.skip_preflight_check = QCheckBox("Без проверки воспроизведения")

        self.command_preview = QTextEdit()
        self.command_preview.setReadOnly(True)
        self.command_preview.setFixedHeight(56)
        self.command_preview.setStyleSheet("font-family: monospace; font-size: 11px;")

        self.log_output = QTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setLineWrapMode(QTextEdit.LineWrapMode.WidgetWidth)
        self.log_output.setWordWrapMode(QTextOption.WrapMode.WordWrap)
        self.log_output.setStyleSheet("font-family: monospace; font-size: 9px;")

        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setMinimum(0)
        self.progress_bar.setMaximum(100)
        
        self.status_label = QLabel()
        self.status_label.setText("")

        self.start_btn = QPushButton("  Запустить")
        self.start_btn.setIcon(_icon("media-playback-start"))
        self.start_btn.setIconSize(QSize(18, 18))
        self.start_btn.setFixedHeight(36)
        self.start_btn.setMinimumWidth(140)

        self.cancel_btn = QPushButton("  Остановить")
        self.cancel_btn.setIcon(_icon("media-playback-stop"))
        self.cancel_btn.setIconSize(QSize(18, 18))
        self.cancel_btn.setFixedHeight(36)
        self.cancel_btn.setMinimumWidth(140)
        self.cancel_btn.setEnabled(False)

        self.clear_log_btn = QToolButton()
        self.clear_log_btn.setIcon(_icon("edit-clear-history"))
        self.clear_log_btn.setToolTip("Очистить журнал")
        self.clear_log_btn.clicked.connect(self.log_output.clear)

        self.language_combo = QComboBox()
        self.language_combo.addItem("English", "en")
        self.language_combo.addItem("Русский", "ru")
        self._current_lang = "en"
        
        self.show_log_check = QCheckBox("Показать журнал")
        self.show_log_check.setChecked(True)

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setSpacing(8)
        root.setContentsMargins(10, 10, 10, 10)

        self.tabs = QTabWidget()
        root.addWidget(self.tabs)

        main_tab = QWidget()
        main_layout = QVBoxLayout(main_tab)
        main_layout.setSpacing(8)
        main_layout.setContentsMargins(10, 10, 10, 10)

        settings_tab = QWidget()
        settings_scroll = QScrollArea()
        settings_scroll.setWidgetResizable(True)
        settings_content = QWidget()
        settings_layout = QFormLayout(settings_content)
        settings_layout.setSpacing(12)
        
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        self.auto_restart_check = QCheckBox(strings.get("auto_restart", "Auto-restart on failure"))
        self.auto_restart_check.setChecked(True)
        settings_layout.addRow(self.auto_restart_check)
        
        self.max_concurrent_spin = QSpinBox()
        self.max_concurrent_spin.setRange(1, 10)
        self.max_concurrent_spin.setValue(1)
        self._max_concurrent_label = QLabel(strings.get("max_concurrent", "Max concurrent:"))
        settings_layout.addRow(self._max_concurrent_label, self.max_concurrent_spin)
        self._max_warning = QLabel(strings.get("max_concurrent_warning", ""))
        self._max_warning.setStyleSheet("color: gray; font-size: 10px;")
        settings_layout.addRow(self._max_warning)
        
        self.timeout_spin = QSpinBox()
        self.timeout_spin.setRange(30, 300)
        self.timeout_spin.setValue(120)
        self._timeout_label = QLabel(strings.get("timeout", "Timeout (seconds):"))
        settings_layout.addRow(self._timeout_label, self.timeout_spin)
        self._timeout_warning_label = QLabel(strings.get("timeout_warning", ""))
        self._timeout_warning_label.setStyleSheet("color: gray; font-size: 10px;")
        settings_layout.addRow(self._timeout_warning_label)
        
        self._language_label = QLabel(strings.get("language", "Language:"))
        settings_layout.addRow(self._language_label, self.language_combo)
        
        settings_scroll.setWidget(settings_content)
        settings_tab.setLayout(QVBoxLayout())
        settings_tab.layout().addWidget(settings_scroll)

        self.tabs.addTab(main_tab, strings.get("main_tab", "Main"))
        self.tabs.addTab(settings_tab, strings.get("settings_tab", "Settings"))

        source_group = QGroupBox(strings.get("source", "Source"))
        source_group.setObjectName("source_group")
        source_form = QFormLayout()
        source_form.setRowWrapPolicy(QFormLayout.RowWrapPolicy.WrapLongRows)
        source_form.setSpacing(6)

        input_row = QHBoxLayout()
        input_row.setSpacing(4)
        input_row.addWidget(self.input_edit)
        input_row.addWidget(self.paste_btn)
        input_row.addWidget(self.add_to_queue_btn)
        
        browse_input_btn = QToolButton()
        browse_input_btn.setIcon(_icon("document-open"))
        browse_input_btn.setToolTip(strings.get("browse_file", ""))
        browse_input_btn.clicked.connect(self._browse_input)
        input_row.addWidget(browse_input_btn)
        input_row.addWidget(self.search_btn)
        self.browse_input_btn = browse_input_btn
        
        self._source_label_widget = QLabel(strings.get("source_label", "Source:"))
        source_form.addRow(self._source_label_widget, input_row)
        
        self._source_info_label = QLabel()
        self._source_info_label.setStyleSheet("color: gray; font-size: 10px; padding: 2px;")
        self._source_info_label.setVisible(False)
        source_form.addRow(self._source_info_label)
        
        self._queue_label_widget = QLabel()
        self._queue_label_widget.setText(strings.get("queue_label", "Queue:"))
        source_form.addRow(self._queue_label_widget)
        source_form.addRow(self.queue_list)
        
        output_row = QHBoxLayout()
        output_row.setSpacing(4)
        output_row.addWidget(self.output_edit)
        browse_output_btn = QToolButton()
        browse_output_btn.setIcon(_icon("folder-open"))
        browse_output_btn.setToolTip(strings.get("browse_folder", ""))
        browse_output_btn.clicked.connect(self._browse_output)
        output_row.addWidget(browse_output_btn)
        self.browse_output_btn = browse_output_btn
        self._output_label_widget = QLabel(strings.get("output_label", "Output folder:"))
        source_form.addRow(self._output_label_widget, output_row)

        source_group.setLayout(source_form)
        self.source_group = source_group
        main_layout.addWidget(source_group)

        preview_group = QGroupBox(strings.get("command", "Command"))
        preview_group.setObjectName("preview_group")
        self.preview_group = preview_group
        preview_layout = QVBoxLayout()
        preview_layout.setContentsMargins(6, 6, 6, 6)
        preview_layout.addWidget(self.command_preview)
        preview_group.setLayout(preview_layout)
        main_layout.addWidget(preview_group)

        btn_row = QHBoxLayout()
        btn_row.addWidget(self.show_log_check)
        btn_row.addStretch()
        btn_row.addWidget(self.start_btn)
        btn_row.addWidget(self.cancel_btn)
        main_layout.addLayout(btn_row)

        status_layout = QVBoxLayout()
        status_layout.setContentsMargins(0, 0, 0, 0)
        status_layout.setSpacing(2)
        status_layout.addWidget(self.status_label)
        status_layout.addWidget(self.progress_bar)
        main_layout.addLayout(status_layout)

        log_group = QGroupBox(strings.get("log", "Log"))
        log_layout = QVBoxLayout()
        log_layout.setContentsMargins(6, 6, 6, 6)
        log_layout.setSpacing(4)

        log_header = QHBoxLayout()
        log_header.addStretch()
        log_header.addWidget(self.clear_log_btn)
        log_layout.addLayout(log_header)
        log_layout.addWidget(self.log_output)
        log_group.setLayout(log_layout)
        self.log_group = log_group
        main_layout.addWidget(log_group, stretch=1)
        self._status_info_label = QLabel()
        self._status_info_label.setStyleSheet("font-size: 10px; color: gray; padding: 4px;")
        main_layout.addWidget(self._status_info_label)
        
        self.show_log_check.stateChanged.connect(self._on_log_visibility_changed)

        # Settings tab content - Parameters, Authorization, Flags
        params_group = QGroupBox(strings.get("parameters", "Parameters"))
        self.params_group = params_group
        params_form = QFormLayout()
        params_form.setSpacing(6)
        params_form.addRow(strings.get("api_url", "API URL:"), self.api_url_edit)
        quality_row = QHBoxLayout()
        quality_row.setSpacing(4)
        quality_row.addWidget(self.quality_combo)
        quality_row.addWidget(self.quality_help_btn)
        self._quality_label = QLabel(strings.get("quality", "Quality:"))
        params_form.addRow(self._quality_label, quality_row)
        params_form.addRow(strings.get("retries", "Retries:"), self.retries_spin)
        params_group.setLayout(params_form)
        settings_layout.addRow(params_group)
        
        auth_group = QGroupBox(strings.get("auth", "Authorization"))
        self.auth_group = auth_group
        auth_form = QFormLayout()
        auth_form.setSpacing(6)
        self._username_label = QLabel(strings.get("username", "Username:"))
        auth_form.addRow(self._username_label, self.username_edit)
        self._login_key_label = QLabel(strings.get("login_key", "Login key:"))
        auth_form.addRow(self._login_key_label, self.login_key_edit)
        self._password_label = QLabel(strings.get("password", "Password:"))
        auth_form.addRow(self._password_label, self.password_edit)
        auth_group.setLayout(auth_form)
        settings_layout.addRow(auth_group)
        
        flags_group = QGroupBox(strings.get("flags", "Flags"))
        self.flags_group = flags_group
        flags_layout = QGridLayout()
        flags_layout.setSpacing(8)
        
        flags_layout.addWidget(self.no_lyrics_check, 0, 0)
        flags_layout.addWidget(self.lyrics_providers_btn, 0, 1)
        flags_layout.addWidget(self.no_genres_check, 0, 2)
        flags_layout.addWidget(self.genre_providers_btn, 0, 3)
        flags_layout.addWidget(self.no_bpm_check, 1, 0)
        flags_layout.addWidget(self.no_zip_check, 1, 1)
        flags_layout.addWidget(self.artist_folders_check, 1, 2)
        flags_layout.addWidget(self.skip_preflight_check, 1, 3)
        
        flags_group.setLayout(flags_layout)
        settings_layout.addRow(flags_group)

        self._hide_command_check = QCheckBox()
        self._hide_command_check.setText(strings.get("hide_command", "Hide command box"))
        self._hide_command_check.setChecked(True)
        self._hide_command_check.stateChanged.connect(self._on_hide_command_changed)
        settings_layout.addRow(self._hide_command_check)

        self.config_edit_btn = QPushButton(strings.get("config_edit", "Edit Config Files"))
        self.config_edit_btn.clicked.connect(self._show_config_editor)
        settings_layout.addRow(self.config_edit_btn)

    def _connect_signals(self) -> None:
        self.start_btn.clicked.connect(self._start)
        self.cancel_btn.clicked.connect(self._cancel)
        self.language_combo.currentIndexChanged.connect(self._on_language_changed)
        self.add_to_queue_btn.clicked.connect(self._add_to_queue)
        self.search_btn.clicked.connect(self._show_search_dialog)

        for widget in (
            self.output_edit,
            self.api_url_edit,
            self.username_edit,
            self.login_key_edit,
            self.password_edit,
        ):
            widget.textChanged.connect(self._refresh_preview)
        
        self.input_edit.textChanged.connect(self._on_input_changed)

        self.quality_combo.currentIndexChanged.connect(self._refresh_preview)

        for check in (
            self.no_lyrics_check,
            self.no_genres_check,
            self.no_bpm_check,
            self.no_zip_check,
            self.artist_folders_check,
            self.skip_preflight_check,
        ):
            check.toggled.connect(self._refresh_preview)

        self.genre_providers_btn.clicked.connect(self._show_genre_providers_dialog)
        self.lyrics_providers_btn.clicked.connect(self._show_lyrics_providers_dialog)
        self.retries_spin.valueChanged.connect(self._refresh_preview)

    def _on_language_changed(self, index: int) -> None:
        lang = self.language_combo.currentData()
        self.settings.setValue("language", lang)
        self._apply_language(lang)

    def _apply_language(self, lang: str) -> None:
        strings = STRINGS.get(lang, STRINGS["en"])
        self._current_lang = lang
        self.setWindowTitle(strings.get("app_title", "Monodownload"))
        self.no_lyrics_check.setText(strings.get("no_lyrics", "No lyrics (.lrc)"))
        self.no_genres_check.setText(strings.get("no_genres", "No genres"))
        self.no_bpm_check.setText(strings.get("no_bpm", "No BPM"))
        self.no_zip_check.setText(strings.get("no_zip", "No ZIP"))
        self.artist_folders_check.setText(strings.get("artist_folders", "Artist folders"))
        self.skip_preflight_check.setText(strings.get("skip_preflight", "Skip playback check"))
        self.input_edit.setPlaceholderText(strings.get("source_ph", ""))
        self.api_url_edit.setPlaceholderText(strings.get("api_url_ph", "https://…  " + strings.get("output_ph_alt", "(optional)")))
        self.username_edit.setPlaceholderText(strings.get("output_ph_alt", "(optional)"))
        self.login_key_edit.setPlaceholderText(strings.get("output_ph_alt", "(optional)"))
        self.password_edit.setPlaceholderText(strings.get("output_ph_alt", "(optional)"))
        self.paste_btn.setToolTip(strings.get("paste_tooltip", ""))
        if self.browse_input_btn:
            self.browse_input_btn.setToolTip(strings.get("browse_file", ""))
        if self.browse_output_btn:
            self.browse_output_btn.setToolTip(strings.get("browse_folder", ""))
        self.clear_log_btn.setToolTip(strings.get("clear_log", ""))
        
        self._update_quality_combo_items()
        
        if hasattr(self, 'source_group'):
            self.source_group.setTitle(strings.get("source", "Source"))
        if hasattr(self, 'params_group'):
            self.params_group.setTitle(strings.get("parameters", "Parameters"))
        if hasattr(self, 'auth_group'):
            self.auth_group.setTitle(strings.get("auth", "Authorization"))
        if hasattr(self, 'flags_group'):
            self.flags_group.setTitle(strings.get("flags", "Flags"))
        if hasattr(self, 'preview_group'):
            self.preview_group.setTitle(strings.get("command", "Command"))
        if hasattr(self, 'log_group'):
            self.log_group.setTitle(strings.get("log", "Log"))
        if self.tabs:
            self.tabs.setTabText(0, strings.get("main_tab", "Main"))
            self.tabs.setTabText(1, strings.get("settings_tab", "Settings"))
        if self.auto_restart_check:
            self.auto_restart_check.setText(strings.get("auto_restart", "Auto-restart on failure"))
        if self.add_to_queue_btn:
            self.add_to_queue_btn.setToolTip(strings.get("add_to_queue_tooltip", "Add to queue"))
        if self.quality_help_btn:
            self.quality_help_btn.setToolTip(strings.get("quality_help_tooltip", "Quality may fall back..."))
        self.show_log_check.setText(strings.get("show_log", ""))
        if self._max_concurrent_label:
            self._max_concurrent_label.setText(strings.get("max_concurrent", "Max concurrent:"))
        if self._max_warning:
            self._max_warning.setText(strings.get("max_concurrent_warning", ""))
        if self._timeout_label:
            self._timeout_label.setText(strings.get("timeout", "Timeout (seconds):"))
        if self._timeout_warning_label:
            self._timeout_warning_label.setText(strings.get("timeout_warning", ""))
        if self._language_label:
            self._language_label.setText(strings.get("language", "Language:"))
        self._update_quality_combo_items()
        if self._source_label_widget:
            self._source_label_widget.setText(strings.get("source_label", "Source:"))
        if self._queue_label_widget:
            self._queue_label_widget.setText(strings.get("queue_label", "Queue:"))
        if self._output_label_widget:
            self._output_label_widget.setText(strings.get("output_label", "Output folder:"))
        if self._quality_label:
            self._quality_label.setText(strings.get("quality", "Quality:"))
        if self._username_label:
            self._username_label.setText(strings.get("username", "Username:"))
        if self._login_key_label:
            self._login_key_label.setText(strings.get("login_key", "Login key:"))
        if self._password_label:
            self._password_label.setText(strings.get("password", "Password:"))
        self.start_btn.setText(f"  {strings.get('start', 'Start')}")
        self.cancel_btn.setText(f"  {strings.get('cancel', 'Stop')}")
        if self.search_btn:
            self.search_btn.setText(strings.get("search", "Search"))
            self.search_btn.setToolTip(strings.get("search_dialog_title", "Search tracks"))
        if self._hide_command_check:
            self._hide_command_check.setText(strings.get("hide_command", "Hide command box"))

    def _update_quality_combo_items(self) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        self.quality_combo.clear()
        self.quality_combo.addItem(strings.get("quality_hi_res", "Hi-Res Lossless (24-bit FLAC)"), "HI_RES_LOSSLESS")
        self.quality_combo.addItem(strings.get("quality_lossless", "Lossless (16-bit FLAC)"), "LOSSLESS")
        self.quality_combo.addItem(strings.get("quality_low", "Low (HE-AAC)"), "LOW")

    def _on_log_visibility_changed(self, state: int = 0) -> None:
        checked = self.show_log_check.isChecked()
        self.settings.setValue("show_log", checked)
        self.log_group.setVisible(checked)

    def _on_hide_command_changed(self, state: int) -> None:
        self._hide_command = state == 2
        self.settings.setValue("hideCommand", self._hide_command)
        if hasattr(self, 'preview_group'):
            self.preview_group.setVisible(not self._hide_command)

    def _update_status_info(self) -> None:
        if not hasattr(self, '_status_info_label'):
            return
        info = []
        if self._total_tracks > 0:
            info.append(f"Tracks: {self._completed_tracks + self._failed_tracks}/{self._total_tracks}")
            if self._failed_tracks > 0:
                info.append(f"Failed: {self._failed_tracks}")
        if self._current_album:
            info.append(f"Album: {self._current_album}")
        if self.current_track_label:
            info.append(f"Track: {self.current_track_label}")
        if self._download_speed:
            info.append(f"Speed: {self._download_speed}")
        if self._queue_total > 0:
            info.append(f"Queue: {self._queue_completed}/{self._queue_total}")
        self._status_info_label.setText(" | ".join(info))
        
        # Update title
        title = "Monodownload"
        if self._total_tracks > 0 or self._queue_total > 0:
            parts = []
            if self._total_tracks > 0:
                parts.append(f"[{self._completed_tracks + self._failed_tracks}/{self._total_tracks}]")
            if self._queue_total > 0:
                parts.append(f"[Queue: {self._queue_completed}/{self._queue_total}]")
            title = f"{' '.join(parts)} Monodownload"
        if self.current_track_label:
            title = f"{title} - {self.current_track_label}".strip()
        self.setWindowTitle(title)

    def _show_genre_providers_dialog(self) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        dialog = QDialog(self)
        dialog.setWindowTitle(strings.get("genre_providers", "Genre providers"))
        dialog.setModal(True)
        layout = QVBoxLayout(dialog)
        
        label = QLabel(strings.get("genre_providers", "Select genre providers (order matters):"))
        layout.addWidget(label)
        
        lastfm_layout = QHBoxLayout()
        lastfm_check = QCheckBox(strings.get("lastfm_label", "Last.fm"))
        lastfm_check.setChecked("lastfm" in self.genre_providers)
        lastfm_rate = QLabel(strings.get("lastfm_rate", "Rate limit: ~5 req/sec avg over 5 min"))
        lastfm_rate.setStyleSheet("color: gray; font-size: 10px;")
        lastfm_layout.addWidget(lastfm_check)
        lastfm_layout.addWidget(lastfm_rate)
        lastfm_layout.addStretch()
        layout.addLayout(lastfm_layout)
        
        lastfm_api_layout = QHBoxLayout()
        lastfm_api_label = QLabel(strings.get("lastfm_api_key", "Last.fm API key:"))
        lastfm_api_field = QLineEdit()
        lastfm_api_field.setPlaceholderText(strings.get("output_ph_alt", "(optional)"))
        lastfm_api_field.setText(self.lastfm_api_key)
        lastfm_api_field.setFixedWidth(150)
        lastfm_api_layout.addWidget(lastfm_api_label)
        lastfm_api_layout.addWidget(lastfm_api_field)
        lastfm_api_layout.addStretch()
        layout.addLayout(lastfm_api_layout)
        
        mb_layout = QHBoxLayout()
        mb_check = QCheckBox(strings.get("musicbrainz_label", "MusicBrainz"))
        mb_check.setChecked("musicbrainz" in self.genre_providers)
        mb_rate = QLabel(strings.get("musicbrainz_rate", "Rate limit: 1 req/sec per IP"))
        mb_rate.setStyleSheet("color: gray; font-size: 10px;")
        mb_layout.addWidget(mb_check)
        mb_layout.addWidget(mb_rate)
        mb_layout.addStretch()
        layout.addLayout(mb_layout)
        
        discogs_layout = QHBoxLayout()
        discogs_check = QCheckBox("Discogs")
        discogs_check.setChecked("discogs" in self.genre_providers)
        discogs_rate = QLabel("Requires DISCOGS_TOKEN env var")
        discogs_rate.setStyleSheet("color: gray; font-size: 10px;")
        discogs_layout.addWidget(discogs_check)
        discogs_layout.addWidget(discogs_rate)
        discogs_layout.addStretch()
        layout.addLayout(discogs_layout)
        
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        layout.addWidget(buttons)
        
        def accept():
            self.genre_providers = []
            self.lastfm_api_key = lastfm_api_field.text().strip() if lastfm_check.isChecked() else ""
            if lastfm_check.isChecked():
                self.genre_providers.append("lastfm")
            if mb_check.isChecked():
                self.genre_providers.append("musicbrainz")
            if discogs_check.isChecked():
                self.genre_providers.append("discogs")
            self.settings.setValue("genreProviders", ",".join(self.genre_providers))
            self.settings.setValue("lastfmApiKey", self.lastfm_api_key)
            self._refresh_preview()
            dialog.accept()
        
        buttons.accepted.connect(accept)
        buttons.rejected.connect(dialog.reject)
        
        dialog.exec()

    def _show_lyrics_providers_dialog(self) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        dialog = QDialog(self)
        dialog.setWindowTitle(strings.get("lyrics_providers", "Lyrics providers"))
        dialog.setModal(True)
        layout = QVBoxLayout(dialog)
        
        layout.addWidget(QLabel(strings.get("lyrics_providers", "Select lyrics provider:")))
        provider_combo = QComboBox()
        provider_combo.addItem(strings.get("lrclib_label", "LRCLIB (free)"), "lrclib")
        provider_combo.addItem(strings.get("genius_label", "Genius (needs API key)"), "genius")
        if self.lyrics_providers and self.lyrics_providers[0] in ["lrclib", "genius"]:
            idx = provider_combo.findData(self.lyrics_providers[0])
            if idx >= 0:
                provider_combo.setCurrentIndex(idx)
        layout.addWidget(provider_combo)
        
        genius_api_layout = QHBoxLayout()
        genius_api_label = QLabel(strings.get("genius_api_key", "Genius API key:"))
        genius_api_field = QLineEdit()
        genius_api_field.setPlaceholderText(strings.get("output_ph_alt", "(optional)"))
        genius_api_field.setText(self.genius_api_key)
        genius_api_field.setFixedWidth(150)
        genius_api_layout.addWidget(genius_api_label)
        genius_api_layout.addWidget(genius_api_field)
        genius_api_layout.addStretch()
        layout.addLayout(genius_api_layout)
        
        layout.addWidget(QLabel(strings.get("lyrics_prefs", "Preferences:")))
        synced_only_check = QCheckBox(strings.get("synced_only", "Only synced (LRC) lyrics"))
        synced_only_check.setChecked(self.synced_only)
        layout.addWidget(synced_only_check)
        no_artist_check = QCheckBox(strings.get("no_artist", "Don't include artist in search"))
        no_artist_check.setChecked(self.lyrics_no_artist)
        layout.addWidget(no_artist_check)
        
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        layout.addWidget(buttons)
        
        def accept():
            self.lyrics_providers = [provider_combo.currentData()]
            self.genius_api_key = genius_api_field.text().strip() if provider_combo.currentData() == "genius" else ""
            self.synced_only = synced_only_check.isChecked()
            self.lyrics_no_artist = no_artist_check.isChecked()
            self.settings.setValue("lyricsProviders", self.lyrics_providers[0])
            self.settings.setValue("geniusApiKey", self.genius_api_key)
            self.settings.setValue("syncedOnly", self.synced_only)
            self.settings.setValue("lyricsNoArtist", self.lyrics_no_artist)
            self._refresh_preview()
            dialog.accept()
        
        buttons.accepted.connect(accept)
        buttons.rejected.connect(dialog.reject)
        
        dialog.exec()

    def _on_output(self) -> None:
        data = self.process.readAllStandardOutput().data().decode(errors="ignore")
        lines = data.strip().split("\n") if data.strip() else []
        
        for line in lines:
            self._log(line)
            self._update_progress(line)
            self._update_status(line)
            self._fetch_source_info_on_resolve(line)

    def _fetch_source_info_on_resolve(self, line: str) -> None:
        if line.startswith("Resolving source:") or line.startswith("Cache stats:"):
            source = self.input_edit.text().strip()
            if source and (source.startswith("http") or "/artist/" in source or "/album/" in source):
                QApplication.processEvents()
                api_url = self._get_api_url()
                try:
                    item_url = None
                    if "/artist/" in source:
                        match = re.search(r'/artist/([^/?#]+)', source)
                        if match:
                            item_url = f"{api_url}/py/artist?id={match.group(1)}"
                    elif "/album/" in source:
                        match = re.search(r'/album/([^/?#]+)', source)
                        if match:
                            item_url = f"{api_url}/py/album?id={match.group(1)}"
                    elif "/track/" in source:
                        match = re.search(r'/track/([^/?#]+)', source)
                        if match:
                            item_url = f"{api_url}/py/info?id={match.group(1)}"
                    
                    if item_url and self._source_info_label:
                        data = urllib.request.urlopen(item_url, timeout=5).read()
                        result = json.loads(data.decode())
                        name = result.get("artist", {}).get("name") or result.get("album", {}).get("title") or result.get("title") or "Unknown"
                        stype = "Artist" if "/artist/" in source else "Album" if "/album/" in source else "Track"
                        self._source_info_label.setText(f"{stype}: {name}")
                        self._source_info_label.setVisible(True)
                except Exception:
                    pass

    def _fetch_source_info_immediate(self) -> None:
        source = self.input_edit.text().strip()
        if source and (source.startswith("http") or "/artist/" in source or "/album/" in source or "/track/" in source):
            api_url = self._get_api_url()
            def fetch():
                try:
                    item_url = None
                    if "/artist/" in source:
                        match = re.search(r'/artist/([^/?#]+)', source)
                        if match:
                            item_url = f"{api_url}/py/artist?id={match.group(1)}"
                    elif "/album/" in source:
                        match = re.search(r'/album/([^/?#]+)', source)
                        if match:
                            item_url = f"{api_url}/py/album?id={match.group(1)}"
                    elif "/track/" in source:
                        match = re.search(r'/track/([^/?#]+)', source)
                        if match:
                            item_url = f"{api_url}/py/info?id={match.group(1)}"
                    
                    if item_url and self._source_info_label:
                        data = urllib.request.urlopen(item_url, timeout=5).read()
                        result = json.loads(data.decode())
                        name = result.get("artist", {}).get("name") or result.get("album", {}).get("title") or result.get("title") or "Unknown"
                        stype = "Artist" if "/artist/" in source else "Album" if "/album/" in source else "Track"
                        self._source_info_label.setText(f"{stype}: {name}")
                        self._source_info_label.setVisible(True)
                except Exception:
                    pass
            QTimer.singleShot(500, fetch)
        elif self._source_info_label:
            self._source_info_label.setVisible(False)

    def _on_input_changed(self) -> None:
        self._fetch_source_info_immediate()
        self._refresh_preview()

    def _browse_input(self) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        path = QFileDialog.getOpenFileName(
            self, strings["browse_file"], str(ROOT_DIR), "CSV/JSON/TXT (*.csv *.json *.txt);;All Files (*)"
        )[0]
        if path:
            self.input_edit.setText(path)

    def _browse_output(self) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        path = QFileDialog.getExistingDirectory(
            self, strings["browse_folder"], self.output_edit.text() or str(ROOT_DIR)
        )
        if path:
            self.output_edit.setText(path)

    def _clear_log(self) -> None:
        self.log_output.clear()

    def _set_running(self, running: bool) -> None:
        self.start_btn.setEnabled(not running)
        self.cancel_btn.setEnabled(running)
        if running:
            self.setWindowTitle(f"Monodownload - {STRINGS.get(self._current_lang, STRINGS['ru']).get('downloading', 'Downloading')}")
        else:
            self.setWindowTitle("Monodownload")
        self.progress_bar.setVisible(running)

    def _update_progress(self, line: str) -> None:
        progress_match = re.search(r'\]\s*(\d+)%', line)
        if progress_match:
            percent = int(progress_match.group(1))
            self.progress_bar.setValue(percent)

    def _update_status(self, line: str) -> None:
        # Parse download status information
        track_match = re.search(r'Downloading:\s*(.+?)\s*\((\d+)/(\d+)\)', line)
        if track_match:
            self._current_track_label = track_match.group(1).strip()
            self._completed_tracks = int(track_match.group(2)) - 1
            self._total_tracks = int(track_match.group(3))
            self._update_status_info()
        
        album_match = re.search(r'Album:\s*(.+)', line)
        if album_match:
            self._current_album = album_match.group(1).strip()
            self._update_status_info()
        
        speed_match = re.search(r'(\d+\.?\d*\s*[KMG]?B/s)', line)
        if speed_match:
            self._download_speed = speed_match.group(1)
            self._update_status_info()
        
        failed_match = re.search(r'failed|error|Failed|Error', line, re.IGNORECASE)
        if failed_match and self.current_track_label:
            self._failed_tracks += 1
            self._update_status_info()

    def _get_api_url(self) -> str:
        api = self.api_url_edit.text().strip()
        if api:
            if not api.startswith(('http://', 'https://')):
                api = 'http://' + api
            return api.rstrip('/')
        return "http://localhost:3000"

    def _show_search_dialog(self) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        dialog = QDialog(self)
        dialog.setWindowTitle(strings.get("search_dialog_title", "Search Tracks"))
        dialog.setModal(True)
        dialog.resize(900, 600)
        layout = QVBoxLayout(dialog)
        layout.setSpacing(8)
        layout.setContentsMargins(10, 10, 10, 10)

        search_layout = QHBoxLayout()
        search_input = QLineEdit()
        search_input.setPlaceholderText(strings.get("search_placeholder", "Enter track, artist, or album..."))
        search_input.setClearButtonEnabled(True)
        search_btn = QPushButton(strings.get("search_btn", "Search"))
        search_layout.addWidget(search_input)
        search_layout.addWidget(search_btn)
        layout.addLayout(search_layout)

        nav_layout = QHBoxLayout()
        back_btn = QToolButton()
        back_btn.setIcon(_icon("go-previous"))
        back_btn.setText(strings.get("back", "Back"))
        back_btn.setEnabled(False)
        forward_btn = QToolButton()
        forward_btn.setIcon(_icon("go-next"))
        forward_btn.setText(strings.get("forward", "Forward"))
        forward_btn.setEnabled(False)
        up_btn = QToolButton()
        up_btn.setIcon(_icon("go-up"))
        up_btn.setText(strings.get("up", "Up"))
        up_btn.setEnabled(False)
        drill_btn = QPushButton()
        drill_btn.setIcon(_icon("view-refresh"))
        drill_btn.setText(strings.get("albums", "Albums"))
        drill_btn.setEnabled(False)
        drill_btn.setFixedWidth(80)
        nav_label = QLabel(strings.get("search_results", "Search Results"))
        nav_label.setStyleSheet("font-weight: bold;")
        nav_layout.addWidget(back_btn)
        nav_layout.addWidget(forward_btn)
        nav_layout.addWidget(up_btn)
        nav_layout.addWidget(drill_btn)
        nav_layout.addWidget(nav_label)
        nav_layout.addStretch()
        layout.addLayout(nav_layout)

        results_tabs = QTabWidget()
        tracks_list = QListWidget()
        tracks_list.setStyleSheet("font-family: monospace; font-size: 11px;")
        artists_list = QListWidget()
        artists_list.setStyleSheet("font-family: monospace; font-size: 11px;")
        albums_list = QListWidget()
        albums_list.setStyleSheet("font-family: monospace; font-size: 11px;")

        results_tabs.addTab(tracks_list, strings.get("tracks", "Tracks"))
        results_tabs.addTab(artists_list, strings.get("artists", "Artists"))
        results_tabs.addTab(albums_list, strings.get("albums", "Albums"))
        layout.addWidget(results_tabs)

        content_stack = QStackedWidget()
        content_stack.addWidget(QWidget())
        content_stack.addWidget(results_tabs)

        artist_albums_widget = QWidget()
        artist_albums_layout = QVBoxLayout(artist_albums_widget)
        artist_albums_layout.setContentsMargins(0, 0, 0, 0)
        artist_albums_list = QListWidget()
        artist_albums_list.setStyleSheet("font-family: monospace; font-size: 11px;")
        artist_albums_layout.addWidget(artist_albums_list)
        content_stack.addWidget(artist_albums_widget)

        album_tracks_widget = QWidget()
        album_tracks_layout = QVBoxLayout(album_tracks_widget)
        album_tracks_layout.setContentsMargins(0, 0, 0, 0)
        album_tracks_list = QListWidget()
        album_tracks_list.setStyleSheet("font-family: monospace; font-size: 11px;")
        album_tracks_layout.addWidget(album_tracks_list)
        content_stack.addWidget(album_tracks_widget)

        layout.addWidget(content_stack)
        content_stack.setCurrentIndex(1)

        btn_row = QHBoxLayout()
        download_btn = QPushButton(strings.get("start", "Start"))
        add_to_queue_btn = QPushButton(strings.get("add_to_queue_tooltip", "Add to Queue"))
        btn_row.addStretch()
        btn_row.addWidget(download_btn)
        btn_row.addWidget(add_to_queue_btn)
        layout.addLayout(btn_row)
        download_btn.setVisible(False)
        add_to_queue_btn.setVisible(False)

        history = []
        history_index = [0]

        def update_nav_buttons():
            back_btn.setEnabled(history_index[0] > 0)
            forward_btn.setEnabled(history_index[0] < len(history) - 1)

        def set_view(idx):
            content_stack.setCurrentIndex(idx)
            if idx == 1:
                up_btn.setEnabled(False)
            on_selection_changed()

        busy = [False]

        def do_search():
            if busy[0]:
                return
            busy[0] = True
            try:
                query = search_input.text().strip()
                if not query:
                    return
                history.clear()
                history_index[0] = 0
                history.append(("search", "", query))
                update_nav_buttons()
                up_btn.setEnabled(False)
                nav_label.setText(strings.get("search_results", "Search Results") + f": {query}")

                def _fetch_artwork(url):
                    if not url:
                        return None
                    try:
                        data = urllib.request.urlopen(url, timeout=10).read()
                        pixmap = QPixmap()
                        pixmap.loadFromData(data)
                        if pixmap.isNull():
                            return None
                        return pixmap.scaled(48, 48, 0, 0)
                    except Exception:
                        return None

                def fetch_search():
                    api_url = self._get_api_url()
                    try:
                        tracks_text = []
                        artists_text = []
                        albums_text = []
                        track_artworks = []
                        artist_artworks = []
                        data = urllib.request.urlopen(f"{api_url}/py/search?a={urllib.parse.quote(query)}", timeout=10).read()
                        result = json.loads(data.decode())
                        data_obj = result.get("data", {}) if isinstance(result, dict) else {}
                        tracks_items = data_obj.get("tracks", {}).get("items", [])
                        for item in tracks_items[:50]:
                            title = item.get("title", "") or item.get("name", "")
                            tid = item.get("id", "")
                            artist = ""
                            if item.get("artist"):
                                artist = item.get("artist", {}).get("name", "")
                            elif item.get("artists"):
                                artist = item.get("artists", [{}])[0].get("name", "")
                            artwork = item.get("artwork") or {}
                            artwork_url = artwork.get("url") if isinstance(artwork, dict) else None
                            tracks_text.append(f"{title} - {artist} (ID: {tid})")
                            track_artworks.append(artwork_url)
                        artists_items = data_obj.get("artists", {}).get("items", [])
                        for item in artists_items[:20]:
                            title = item.get("name", "") or item.get("title", "")
                            tid = item.get("id", "")
                            picture_url = None
                            if isinstance(item.get("pictureUrl"), dict):
                                picture_url = item["pictureUrl"].get("url")
                            elif isinstance(item.get("picture"), str):
                                slug = item["picture"].replace("-", "/")
                                picture_url = f"https://resources.tidal.com/images/{slug}/640x640.jpg"
                            artists_text.append(f"{title} (ID: {tid})")
                            artist_artworks.append(picture_url)
                        data = urllib.request.urlopen(f"{api_url}/py/search?al={urllib.parse.quote(query)}", timeout=10).read()
                        album_items = json.loads(data.decode()).get("data", {}).get("albums", {}).get("items", []) if isinstance(result, dict) else []
                        for item in album_items[:20]:
                            album_id = item.get("id", "")
                            title = item.get("title", "") or item.get("name", "")
                            artist = item.get("artist", {}).get("name", "") or item.get("artists", [{}])[0].get("name", "")
                            albums_text.append(f"{title} - {artist} (ID: {album_id})")
                        return (tracks_text, artists_text, albums_text, track_artworks, artist_artworks, None)
                    except Exception as e:
                        return ([], [], [], [], [], str(e))

                for lst in [tracks_list, artists_list, albums_list]:
                    lst.clear()
                    lst.addItem(f"{strings.get('search_results', 'Searching')}...")

                class SearchWorker(QThread):
                    def __init__(self, parent):
                        super().__init__(parent)
                        self.tracks_result = []
                        self.artists_result = []
                        self.albums_result = []
                        self.track_artworks = {}
                        self.artist_artworks = {}
                        self.error = None

                    def run(self):
                        self.tracks_result, self.artists_result, self.albums_result, track_artworks, artist_artworks, self.error = fetch_search()
                        self.track_artworks = {i: u for i, u in enumerate(track_artworks)}
                        self.artist_artworks = {i: u for i, u in enumerate(artist_artworks)}

                def on_search_done():
                    tracks_list.clear()
                    tracks_list.addItems(worker.tracks_result)
                    for idx in range(tracks_list.count()):
                        artwork_url = worker.track_artworks.get(idx)
                        if artwork_url:
                            pixmap = _fetch_artwork(artwork_url)
                            if pixmap:
                                tracks_list.item(idx).setIcon(QIcon(pixmap))
                    artists_list.clear()
                    artists_list.addItems(worker.artists_result)
                    for idx in range(artists_list.count()):
                        artwork_url = worker.artist_artworks.get(idx)
                        if artwork_url:
                            pixmap = _fetch_artwork(artwork_url)
                            if pixmap:
                                artists_list.item(idx).setIcon(QIcon(pixmap))
                    albums_list.clear()
                    albums_list.addItems(worker.albums_result)
                    if worker.error:
                        for lst in [tracks_list, artists_list, albums_list]:
                            if lst.count() == 0:
                                lst.addItem(f"Error: {worker.error}")

                worker = SearchWorker(dialog)
                worker.finished.connect(on_search_done)
                worker.start()
            finally:
                busy[0] = False

        def show_artist_albums(artist_id, artist_name):
            artist_albums_list.clear()
            artist_albums_list.addItem(f"{strings.get('search_results', 'Loading')}...")
            nav_label.setText(f"{artist_name} - Albums")
            QApplication.processEvents()

            api_url = self._get_api_url()
            try:
                data = urllib.request.urlopen(f"{api_url}/py/artist?f={artist_id}", timeout=10).read()
                result = json.loads(data.decode())
                albums = result.get("albums", {}).get("items", []) if isinstance(result, dict) else []
                artist_albums_list.clear()
                for item in albums[:30]:
                    album_id = item.get("id", "")
                    title = item.get("title", "") or item.get("name", "")
                    artist_albums_list.addItem(f"{title} (ID: {album_id})")
                content_stack.setCurrentIndex(2)
                up_btn.setEnabled(history_index[0] > 0)
            except Exception as e:
                artist_albums_list.clear()
                artist_albums_list.addItem(f"Error: {e}")

        def show_album_tracks(album_id, album_title):
            album_tracks_list.clear()
            album_tracks_list.addItem(f"{strings.get('search_results', 'Loading')}...")
            QApplication.processEvents()

            api_url = self._get_api_url()
            try:
                data = urllib.request.urlopen(f"{api_url}/py/album?id={album_id}", timeout=10).read()
                result = json.loads(data.decode())
                raw_items = result.get("data", {}).get("items", []) if isinstance(result, dict) else []
                items = [item.get("item", item) if isinstance(item, dict) and "item" in item else item for item in raw_items]
                album_tracks_list.clear()
                for item in items[:50]:
                    track_id = item.get("id", "")
                    title = item.get("title", "")
                    artist = item.get("artist", {}).get("name", "") or item.get("artists", [{}])[0].get("name", "")
                    album_tracks_list.addItem(f"{title} - {artist} (ID: {track_id})")
                nav_label.setText(f"{album_title} - Tracks")
                content_stack.setCurrentIndex(3)
                up_btn.setEnabled(history_index[0] > 0)
            except Exception as e:
                album_tracks_list.clear()
                album_tracks_list.addItem(f"Error: {e}")

        def on_track_double_clicked(item):
            match = re.search(r'\(ID: ([\w-]+)\)', item.text())
            if match:
                self.input_edit.setText(f"/track/{match.group(1)}")

        def on_artist_double_clicked(item):
            match = re.search(r'\(ID: (\d+)\)', item.text())
            if match:
                artist_id = match.group(1)
                artist_name = item.text().split(" (ID:")[0]
                if history_index[0] == len(history) - 1:
                    history.append(("artist", artist_id, artist_name))
                    history_index[0] += 1
                else:
                    history[history_index[0] + 1:] = [("artist", artist_id, artist_name)]
                    history_index[0] += 1
                update_nav_buttons()
                show_artist_albums(artist_id, artist_name)

        def on_album_double_clicked(item):
            match = re.search(r'\(ID: ([\w-]+)\)', item.text())
            if match:
                album_id = match.group(1)
                album_title_match = re.search(r'^([^\(]+)', item.text().strip())
                album_title = album_title_match.group(1).strip() if album_title_match else "Unknown Album"
                if history_index[0] == len(history) - 1:
                    history.append(("album", album_id, album_title))
                    history_index[0] += 1
                else:
                    history[history_index[0] + 1:] = [("album", album_id, album_title)]
                    history_index[0] += 1
                update_nav_buttons()
                show_album_tracks(album_id, album_title)

        def on_selection_changed():
            current_idx = content_stack.currentIndex()
            if current_idx == 1:
                current = results_tabs.currentWidget()
                has_selection = current.currentItem() is not None if current else False
                # Update drill button based on current tab
                if results_tabs.currentIndex() == 1:  # Artists tab
                    drill_btn.setText(strings.get("albums", "Albums"))
                    drill_btn.setEnabled(has_selection)
                elif results_tabs.currentIndex() == 2:  # Albums tab
                    drill_btn.setText(strings.get("tracks", "Tracks"))
                    drill_btn.setEnabled(has_selection)
                else:
                    drill_btn.setEnabled(False)
            elif current_idx == 2:
                has_selection = artist_albums_list.currentItem() is not None
                drill_btn.setText(strings.get("tracks", "Tracks"))
                drill_btn.setEnabled(has_selection)
            elif current_idx == 3:
                has_selection = album_tracks_list.currentItem() is not None
                drill_btn.setEnabled(False)
            else:
                has_selection = False
                drill_btn.setEnabled(False)
            download_btn.setVisible(has_selection)
            add_to_queue_btn.setVisible(has_selection)

        def go_back():
            if history_index[0] > 0:
                history_index[0] -= 1
                state = history[history_index[0]]
                if state[0] == "search":
                    content_stack.setCurrentIndex(1)
                elif state[0] == "artist":
                    show_artist_albums(state[1], state[2])
                elif state[0] == "album":
                    show_album_tracks(state[1], state[2])
                up_btn.setEnabled(state[0] != "search")
                update_nav_buttons()

        def go_forward():
            if history_index[0] < len(history) - 1:
                history_index[0] += 1
                state = history[history_index[0]]
                if state[0] == "search":
                    content_stack.setCurrentIndex(1)
                elif state[0] == "artist":
                    show_artist_albums(state[1], state[2])
                elif state[0] == "album":
                    show_album_tracks(state[1], state[2])
                up_btn.setEnabled(state[0] != "search")
                update_nav_buttons()

        def on_drill_clicked():
            current_idx = content_stack.currentIndex()
            if current_idx == 1:
                # From search tabs - drill into artist albums or album tracks
                tab_idx = results_tabs.currentIndex()
                if tab_idx == 1:  # Artists tab
                    item = artists_list.currentItem()
                    if item:
                        match = re.search(r'\(ID: (\d+)\)', item.text())
                        if match:
                            artist_id = match.group(1)
                            artist_name = item.text().split(" (ID:")[0]
                            if history_index[0] == len(history) - 1:
                                history.append(("artist", artist_id, artist_name))
                                history_index[0] += 1
                            else:
                                history[history_index[0] + 1:] = [("artist", artist_id, artist_name)]
                                history_index[0] += 1
                            update_nav_buttons()
                            show_artist_albums(artist_id, artist_name)
                elif tab_idx == 2:  # Albums tab
                    item = albums_list.currentItem()
                    if item:
                        match = re.search(r'\(ID: ([\w-]+)\)', item.text())
                        if match:
                            album_id = match.group(1)
                            album_title_match = re.search(r'^([^\(]+)', item.text().strip())
                            album_title = album_title_match.group(1).strip() if album_title_match else "Unknown Album"
                            if history_index[0] == len(history) - 1:
                                history.append(("album", album_id, album_title))
                                history_index[0] += 1
                            else:
                                history[history_index[0] + 1:] = [("album", album_id, album_title)]
                                history_index[0] += 1
                            update_nav_buttons()
                            show_album_tracks(album_id, album_title)
            elif current_idx == 2:
                # From artist albums - drill into album tracks
                item = artist_albums_list.currentItem()
                if item:
                    match = re.search(r'\(ID: ([\w-]+)\)', item.text())
                    if match:
                        album_id = match.group(1)
                        album_title_match = re.search(r'^([^\(]+)', item.text().strip())
                        album_title = album_title_match.group(1).strip() if album_title_match else "Unknown Album"
                        if history_index[0] == len(history) - 1:
                            history.append(("album", album_id, album_title))
                            history_index[0] += 1
                        else:
                            history[history_index[0] + 1:] = [("album", album_id, album_title)]
                            history_index[0] += 1
                        update_nav_buttons()
                        show_album_tracks(album_id, album_title)

        def go_up():
            if history_index[0] > 0:
                # Navigate to parent level without going back in history
                state = history[history_index[0] - 1]
                if state[0] == "search":
                    content_stack.setCurrentIndex(1)
                    up_btn.setEnabled(False)
                elif state[0] == "artist":
                    show_artist_albums(state[1], state[2])
                    up_btn.setEnabled(history_index[0] > 1)
                elif state[0] == "album":
                    # Go to parent artist (one level up)
                    if history_index[0] > 1:
                        parent_state = history[history_index[0] - 2]
                        show_artist_albums(parent_state[1], parent_state[2])
                        up_btn.setEnabled(history_index[0] > 2)
                    else:
                        # No parent artist, go to search
                        content_stack.setCurrentIndex(1)
                        up_btn.setEnabled(False)
                update_nav_buttons()

        def download_selection():
            current_idx = content_stack.currentIndex()
            if current_idx == 1:
                current = results_tabs.currentWidget()
                if current and current.currentItem():
                    match = re.search(r'\(ID: ([\w-]+)\)', current.currentItem().text())
                    if match:
                        tab_idx = results_tabs.currentIndex()
                        if tab_idx == 1:  # Artists tab
                            self.input_edit.setText(f"/artist/{match.group(1)}")
                        elif tab_idx == 2:  # Albums tab
                            self.input_edit.setText(f"/album/{match.group(1)}")
                        else:  # Tracks tab
                            self.input_edit.setText(f"/track/{match.group(1)}")
                        dialog.accept()
                        self._start()
            elif current_idx == 2:  # Artist albums view
                item = artist_albums_list.currentItem()
                if item:
                    match = re.search(r'\(ID: ([\w-]+)\)', item.text())
                    if match:
                        self.input_edit.setText(f"/album/{match.group(1)}")
                        dialog.accept()
                        self._start()
            elif current_idx == 3:
                item = album_tracks_list.currentItem()
                if item:
                    match = re.search(r'\(ID: ([\w-]+)\)', item.text())
                    if match:
                        self.input_edit.setText(f"/track/{match.group(1)}")
                        dialog.accept()
                        self._start()

        def queue_selection():
            current_idx = content_stack.currentIndex()
            if current_idx == 1:
                current = results_tabs.currentWidget()
                if current and current.currentItem():
                    match = re.search(r'\(ID: ([\w-]+)\)', current.currentItem().text())
                    if match:
                        tab_idx = results_tabs.currentIndex()
                        if tab_idx == 1:  # Artists tab
                            self.input_edit.setText(f"/artist/{match.group(1)}")
                        elif tab_idx == 2:  # Albums tab
                            self.input_edit.setText(f"/album/{match.group(1)}")
                        else:  # Tracks tab
                            self.input_edit.setText(f"/track/{match.group(1)}")
                        dialog.accept()
                        self._add_to_queue()
            elif current_idx == 2:  # Artist albums view
                item = artist_albums_list.currentItem()
                if item:
                    match = re.search(r'\(ID: ([\w-]+)\)', item.text())
                    if match:
                        self.input_edit.setText(f"/album/{match.group(1)}")
                        dialog.accept()
                        self._add_to_queue()
            elif current_idx == 3:
                item = album_tracks_list.currentItem()
                if item:
                    match = re.search(r'\(ID: ([\w-]+)\)', item.text())
                    if match:
                        self.input_edit.setText(f"/track/{match.group(1)}")
                        dialog.accept()
                        self._add_to_queue()

        search_btn.clicked.connect(do_search)
        search_input.returnPressed.connect(do_search)
        back_btn.clicked.connect(go_back)
        forward_btn.clicked.connect(go_forward)
        up_btn.clicked.connect(go_up)
        drill_btn.clicked.connect(on_drill_clicked)

        on_selection_changed()
        content_stack.currentChanged.connect(on_selection_changed)
        results_tabs.currentChanged.connect(on_selection_changed)
        tracks_list.itemClicked.connect(on_selection_changed)
        artists_list.itemClicked.connect(on_selection_changed)
        albums_list.itemClicked.connect(on_selection_changed)
        artist_albums_list.itemClicked.connect(on_selection_changed)
        album_tracks_list.itemClicked.connect(on_selection_changed)

        tracks_list.itemDoubleClicked.connect(on_track_double_clicked)
        artists_list.itemDoubleClicked.connect(on_artist_double_clicked)
        albums_list.itemDoubleClicked.connect(on_album_double_clicked)
        artist_albums_list.itemDoubleClicked.connect(on_album_double_clicked)
        album_tracks_list.itemDoubleClicked.connect(on_track_double_clicked)

        download_btn.clicked.connect(download_selection)
        add_to_queue_btn.clicked.connect(queue_selection)

        dialog.exec()


    def _build_args(self) -> list[str] | None:
        source = self.input_edit.text().strip()
        if not source:
            return None

        runner = shutil.which("bun") or shutil.which("node")
        if not runner:
            return None

        args = [runner, str(SCRIPT_PATH), source]
        output = self.output_edit.text().strip()
        if output:
            args.extend(["--output", output])

        api_url = self.api_url_edit.text().strip()
        if api_url:
            args.extend(["--api-url", api_url])

        quality = self.quality_combo.currentData()
        if quality:
            args.extend(["--quality", quality])

        if self.no_lyrics_check.isChecked():
            args.append("--no-lyrics")

        if self.no_genres_check.isChecked():
            args.append("--no-genres")
        elif self.genre_providers:
            args.extend(["--genre-providers", ",".join(self.genre_providers)])

        if self.no_bpm_check.isChecked():
            args.append("--no-bpm-detect")

        if self.no_zip_check.isChecked():
            args.append("--no-zip")

        if self.lyrics_providers and self.lyrics_providers[0] != "lrclib":
            args.extend(["--lyrics-provider", self.lyrics_providers[0]])

        if self.synced_only:
            args.append("--lyrics-synced-only")

        if self.lyrics_no_artist:
            args.append("--lyrics-no-artist")

        if self.artist_folders_check.isChecked():
            args.append("--artist-folders")

        if self.skip_preflight_check.isChecked():
            args.append("--i-know-it-doesnt-work-but-ill-use-it-anyway")

        args.extend(["--download-retries", str(self.retries_spin.value())])

        return args

    def _get_env_for_api_keys(self) -> QProcessEnvironment:
        env = QProcessEnvironment.systemEnvironment()
        if self.lastfm_api_key:
            env.insert("LASTFM_API_KEY", self.lastfm_api_key)
        if self.genius_api_key:
            env.insert("GENIUS_API_KEY", self.genius_api_key)
        return env

    def _refresh_preview(self) -> None:
        cmd = self._build_args()
        if cmd:
            self.command_preview.setText(" ".join(cmd))

    def _on_finished(self, exit_code: int, exit_status: QProcess.ExitStatus) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        if self._download_queue:
            next_source = self._download_queue.pop(0)
            self.queue_list.takeItem(0)
            self.input_edit.setText(next_source)
            self._start()
            return
        
        # Reset restart counter on successful completion
        if exit_status == QProcess.ExitStatus.NormalExit and exit_code == 0:
            self._restart_count = 0
            self._log(f"\n{strings.get('completed', 'Completed')}.")
        
        # Auto-restart on failure (crashed or non-zero exit code)
        elif not self._cancelled and (exit_status != QProcess.ExitStatus.NormalExit or exit_code != 0):
            if self.auto_restart_check and self.auto_restart_check.isChecked() and self._restart_count < self._max_restarts:
                self._restart_count += 1
                self._log(f"Restarting ({self._restart_count}/{self._max_restarts})...")
                self.input_edit.setText(self._current_source)
                self._start()
                return
            self._log(f"\n{strings.get('error_title', 'Error')}: download failed.")
        
        elif self._cancelled:
            self._log(f"\n{strings.get('cancel', 'Stopped')}.")
        
        self._cancelled = False
        self._set_running(False)
        self.progress_bar.setVisible(False)
        self.current_track_label = ""
        self.total_tracks = 0
        self.current_track_index = 0
        self.setWindowTitle("Monodownload")
        self.status_label.setText("")
        self.status_label.setVisible(False)

    def _log(self, text: str) -> None:
        self.log_output.moveCursor(QTextCursor.MoveOperation.End)
        self.log_output.insertPlainText(text + "\n")
        self.log_output.moveCursor(QTextCursor.MoveOperation.End)

    def _load_settings(self) -> None:
        s = self.settings
        if s.contains("output"):
            self.output_edit.setText(s.value("output"))
        if s.contains("apiUrl"):
            self.api_url_edit.setText(s.value("apiUrl"))
        if s.contains("quality"):
            quality = s.value("quality")
            idx = self.quality_combo.findData(quality)
            if idx >= 0:
                self.quality_combo.setCurrentIndex(idx)
        if s.contains("downloadRetries"):
            self.retries_spin.setValue(int(s.value("downloadRetries")))
        if s.contains("authUsername"):
            self.username_edit.setText(s.value("authUsername"))
        if s.contains("authLoginKey"):
            self.login_key_edit.setText(s.value("authLoginKey"))
        if s.contains("noLyrics"):
            self.no_lyrics_check.setChecked(s.value("noLyrics", type=bool))
        if s.contains("noGenres"):
            self.no_genres_check.setChecked(s.value("noGenres", type=bool))
        if s.contains("genreProviders"):
            gp = s.value("genreProviders")
            self.genre_providers = gp.split(",") if gp else ["musicbrainz", "lastfm"]
        if s.contains("lastfmApiKey"):
            self.lastfm_api_key = s.value("lastfmApiKey")
        if s.contains("syncedOnly"):
            self.synced_only = s.value("syncedOnly", type=bool)
        if s.contains("lyricsNoArtist"):
            self.lyrics_no_artist = s.value("lyricsNoArtist", type=bool)
        if s.contains("noBpm"):
            self.no_bpm_check.setChecked(s.value("noBpm", type=bool))
        if s.contains("geniusApiKey"):
            self.genius_api_key = s.value("geniusApiKey")
        if s.contains("noZip"):
            self.no_zip_check.setChecked(s.value("noZip", type=bool))
        if s.contains("artistFolders"):
            self.artist_folders_check.setChecked(s.value("artistFolders", type=bool))
        if s.contains("skipPreflight"):
            self.skip_preflight_check.setChecked(s.value("skipPreflight", type=bool))
        if s.contains("lyricsProviders"):
            lp = s.value("lyricsProviders")
            if lp in ["lrclib", "genius"]:
                self.lyrics_providers = [lp]
        if s.contains("autoRestart"):
            self.auto_restart_check.setChecked(s.value("autoRestart", type=bool))
        if s.contains("maxConcurrent") and self.max_concurrent_spin:
            self.max_concurrent_spin.setValue(int(s.value("maxConcurrent")))
        if s.contains("timeout") and self.timeout_spin:
            self.timeout_spin.setValue(int(s.value("timeout")))
        if s.contains("hideCommand"):
            hidden = s.value("hideCommand", type=bool)
            self._hide_command = hidden
            if hasattr(self, 'preview_group'):
                self.preview_group.setVisible(not hidden)
            if hasattr(self, '_hide_command_check'):
                self._hide_command_check.setChecked(hidden)


    def _save_settings(self) -> None:
        s = self.settings
        s.setValue("output", self.output_edit.text())
        s.setValue("apiUrl", self.api_url_edit.text())
        s.setValue("quality", self.quality_combo.currentData() or "hi_res_lossless")
        s.setValue("downloadRetries", self.retries_spin.value())
        s.setValue("authUsername", self.username_edit.text())
        s.setValue("authLoginKey", self.login_key_edit.text())
        s.setValue("noLyrics", self.no_lyrics_check.isChecked())
        s.setValue("noGenres", self.no_genres_check.isChecked())
        s.setValue("genreProviders", ",".join(self.genre_providers))
        s.setValue("syncedOnly", self.synced_only)
        s.setValue("lyricsNoArtist", self.lyrics_no_artist)
        s.setValue("noBpm", self.no_bpm_check.isChecked())
        s.setValue("noZip", self.no_zip_check.isChecked())
        s.setValue("artistFolders", self.artist_folders_check.isChecked())
        s.setValue("skipPreflight", self.skip_preflight_check.isChecked())
        if self.auto_restart_check:
            s.setValue("autoRestart", self.auto_restart_check.isChecked())
        if self.max_concurrent_spin:
            s.setValue("maxConcurrent", self.max_concurrent_spin.value())
        if self.timeout_spin:
            s.setValue("timeout", self.timeout_spin.value())
        s.setValue("geometry", self.saveGeometry())

    def _start(self) -> None:
        if self.process.state() == QProcess.ProcessState.Running:
            return
        
        cmd = self._build_args()
        if not cmd:
            strings = STRINGS.get(self._current_lang, STRINGS["en"])
            self._log(strings.get("empty_source_warning", "Enter a source and ensure bun or node is available in PATH."))
            return
        
        self._current_source = self.input_edit.text().strip()
        self._log(f"$ {cmd[0]} {' '.join(cmd[1:])}")
        env = self._get_env_for_api_keys()
        self.process.setProcessEnvironment(env)
        self._set_running(True)
        self.process.start(cmd[0], cmd[1:])

    def _cancel(self) -> None:
        if self.process.state() == QProcess.ProcessState.Running:
            self._cancelled = True
            self.process.kill()

    def _add_to_queue(self) -> None:
        source = self.input_edit.text().strip()
        if source:
            self._download_queue.append(source)
            self.queue_list.addItem(source)
            self.input_edit.clear()

    def _show_config_editor(self) -> None:
        strings = STRINGS.get(self._current_lang, STRINGS["en"])
        dialog = QDialog(self)
        dialog.setWindowTitle(strings.get("config_editor_title", "Config Editor"))
        dialog.setModal(True)
        dialog.resize(500, 300)
        layout = QVBoxLayout(dialog)

        api_keys_group = QGroupBox(strings.get("config_api_keys", "API Keys (api-keys.json)"))
        api_keys_layout = QFormLayout()

        self._config_lastfm_edit = QLineEdit()
        self._config_lastfm_edit.setText(self.lastfm_api_key)
        api_keys_layout.addRow(strings.get("lastfm_api_key", "Last.fm API key:"), self._config_lastfm_edit)

        self._config_genius_edit = QLineEdit()
        self._config_genius_edit.setText(self.genius_api_key)
        api_keys_layout.addRow(strings.get("genius_api_key", "Genius API key:"), self._config_genius_edit)

        api_keys_group.setLayout(api_keys_layout)
        layout.addWidget(api_keys_group)

        layout.addStretch()

        btn_box = QDialogButtonBox(QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel)
        layout.addWidget(btn_box)

        def save_config():
            self.lastfm_api_key = self._config_lastfm_edit.text().strip()
            self.genius_api_key = self._config_genius_edit.text().strip()
            self._save_api_keys_to_file()
            self._refresh_preview()
            dialog.accept()

        btn_box.accepted.connect(save_config)
        btn_box.rejected.connect(dialog.reject)

        dialog.exec()

    def _save_api_keys_to_file(self) -> None:
        try:
            api_keys = {"lastfm_api_key": self.lastfm_api_key, "genius_api_key": self.genius_api_key}
            ARTIST_API_KEYS_PATH.parent.mkdir(parents=True, exist_ok=True)
            ARTIST_API_KEYS_PATH.write_text(json.dumps(api_keys, indent=2))
        except Exception:
            pass

    def _load_api_keys_from_file(self) -> None:
        try:
            if ARTIST_API_KEYS_PATH.exists():
                data = json.loads(ARTIST_API_KEYS_PATH.read_text())
                if self.lastfm_api_key == "":
                    self.lastfm_api_key = data.get("lastfm_api_key", "")
                if self.genius_api_key == "":
                    self.genius_api_key = data.get("genius_api_key", "")
        except Exception:
            pass


if __name__ == "__main__":
    app = QApplication(sys.argv)
    apply_style(app)
    gui = MonodownloadGui()
    gui.show()
    sys.exit(app.exec())