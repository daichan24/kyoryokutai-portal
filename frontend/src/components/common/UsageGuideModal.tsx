import React from 'react';
import { X, CheckCircle2, PlayCircle, Circle } from 'lucide-react';

interface UsageGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsageGuideModal: React.FC<UsageGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-2xl font-bold dark:text-gray-100">ミッション・プロジェクト・タスクの使い方</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 prose max-w-none dark:prose-invert">
          <div>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
              このサービスでは、<strong>「ミッション → プロジェクト → タスク」</strong>という3つの階層で、
              協力隊任期中の活動や起業準備を整理・管理します。
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              それぞれの役割と使い方は以下の通りです。
            </p>
          </div>

          <section className="border-l-4 border-blue-500 dark:border-blue-400 pl-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">ミッション（最上位の目標）</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              ミッションは<strong>「将来的に収入の柱となるもの」</strong>や<strong>「任期中に成し遂げたい最終目標」</strong>を設定する場所です。
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-3">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">例：</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>宿を運営する</li>
                <li>在宅ワークを事業として成立させる</li>
                <li>地域イベントを軸にした事業を立ち上げる</li>
              </ul>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-3">
              基本的には<strong>1つのミッション＝1つの収入の柱</strong>を想定しています。
              ただし、人によっては<strong>2つ以上のミッション</strong>を持つことも問題ありません。
            </p>

            <p className="text-gray-700 dark:text-gray-300 mb-3">
              また、役場から指定されている活動テーマや、収益化を目的としない「ミッション型」の活動についても、
              ミッションとして登録して構いません。
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">ミッションの達成率について</h4>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                ミッションには<strong>達成率（％）</strong>を設定します。
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>100％達成＝収益化・本格稼働が可能な状態</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>宿の場合：営業を開始し、運用がスタートした時点で100％</li>
                <li>事業の場合：実際に収入が発生し、継続可能な状態</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                ミッションは<strong>「大目標」</strong>にあたります。
              </p>
            </div>
          </section>

          <section className="border-l-4 border-green-500 dark:border-green-400 pl-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">プロジェクト（ミッションを達成するための中間目標）</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              プロジェクトは、ミッションを達成するための<strong>「具体的なアプローチ」</strong>や<strong>「中目標」</strong>です。
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>1つのミッションには、複数のプロジェクト</strong>が紐づきます。
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-3">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">例（ミッション：宿を運営する）：</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>宿を建てる・整備する</li>
                <li>宿を認知してもらうためのイベントを実施する</li>
                <li>集客・広報（SNS運用など）を行う</li>
              </ul>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-3">
              プロジェクトの数は人やミッションによって異なります。
            </p>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mt-4">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">ミッション達成率との関係</h4>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                ミッションの達成率は、プロジェクトの完了数を基準に考えます。
              </p>
              <div className="bg-white dark:bg-gray-800 rounded p-3 mb-2">
                <p className="text-gray-700 dark:text-gray-300 mb-1"><strong>例：</strong></p>
                <p className="text-gray-700 dark:text-gray-300 mb-1">ミッションに紐づくプロジェクトが3つある場合</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                  <li>1つ完了 → 約33％</li>
                  <li>2つ完了 → 約66％</li>
                  <li>3つ完了 → 100％（収益化可能）</li>
                </ul>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                このように、プロジェクトはミッション達成率を構成する単位です。
              </p>
            </div>
          </section>

          <section className="border-l-4 border-purple-500 dark:border-purple-400 pl-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">タスク（プロジェクトを進めるための具体的な行動）</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              タスクは、プロジェクトを実行するための<strong>「日々の具体的な行動（小目標）」</strong>です。
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>1つのプロジェクトには、複数のタスク</strong>が紐づきます。
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-3">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">例（プロジェクト：宿を建てる）：</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>相見積もりを取る</li>
                <li>候補地を探す</li>
                <li>関係者とつながる</li>
                <li>企画書を作成する</li>
              </ul>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-3">
              タスクは、スケジュールや日常業務と直接ひも付く最小単位です。
            </p>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mt-4">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">プロジェクトとタスクの関係</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>プロジェクトは複数のタスクから構成されます</li>
                <li>タスクは増減することがあります</li>
                <li>必要なタスクが一通り完了した時点で、プロジェクトを「完了」状態にします</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                タスクがすべて終わったから自動的に完了、ではなく、
                <strong>「このプロジェクトは目的を果たした」</strong>と判断したタイミングで完了にする運用を推奨します。
              </p>
            </div>
          </section>

          <section className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">全体構造のまとめ</h3>
            
            <div className="space-y-3 mb-4">
              <div>
                <strong className="text-gray-900 dark:text-gray-100">ミッション</strong>
                <ul className="list-disc list-inside ml-4 text-gray-700 dark:text-gray-300">
                  <li>最終的な目的・収入の柱</li>
                  <li>任期中に成し遂げたいゴール</li>
                </ul>
              </div>
              <div>
                <strong className="text-gray-900 dark:text-gray-100">プロジェクト</strong>
                <ul className="list-disc list-inside ml-4 text-gray-700 dark:text-gray-300">
                  <li>ミッションを達成するための中目標</li>
                  <li>複数存在する</li>
                </ul>
              </div>
              <div>
                <strong className="text-gray-900 dark:text-gray-100">タスク</strong>
                <ul className="list-disc list-inside ml-4 text-gray-700 dark:text-gray-300">
                  <li>プロジェクトを進めるための日々の具体行動</li>
                </ul>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded p-4 mb-4">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">構造としては、以下の関係になります。</p>
              <pre className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto">
{`ミッション
 ├─ プロジェクトA
 │    ├─ タスク1
 │    ├─ タスク2
 │    └─ タスク3
 └─ プロジェクトB
      ├─ タスク1
      └─ タスク2`}
              </pre>
            </div>
          </section>

          <section className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">運用の考え方（重要）</h3>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li>
                <strong>ミッション</strong>は<strong>「なぜ協力隊にいるのか」</strong>を明確にするもの
              </li>
              <li>
                <strong>プロジェクト</strong>は<strong>「どうやって実現するか」</strong>を整理するもの
              </li>
              <li>
                <strong>タスク</strong>は<strong>「今日・今週なにをやるか」</strong>を具体化するもの
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              この3層を意識して使うことで、
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4 mt-2">
              <li>行動の意味が見失われにくくなる</li>
              <li>計画と日常業務が自然につながる</li>
              <li>任期終了時に「何を成し遂げたか」を説明しやすくなる</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4 font-medium">
              という効果があります。
            </p>
          </section>

          {/* タスクのアイコン説明 */}
          <section className="border-l-4 border-orange-500 dark:border-orange-400 pl-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">タスクのステータスアイコン</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">未着手</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">まだ開始していないタスクです</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <PlayCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">進行中</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">現在取り組んでいるタスクです</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">完了</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">タスクが完了した状態です</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end p-6 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

