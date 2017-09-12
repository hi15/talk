import Tab from './containers/Tab';
import Tag from './containers/Tag';
import TabPane from './containers/TabPane';
import translations from './translations.yml';
import update from 'immutability-helper';
import reducer from './reducer';
import ModTag from './containers/ModTag';
import ModActionButton from './containers/ModActionButton';
import ModSubscription from './containers/ModSubscription';
import {gql} from 'react-apollo';

import {findCommentInEmbedQuery} from 'coral-embed-stream/src/graphql/utils';
import {prependNewNodes} from 'plugin-api/beta/client/utils';

export default {
  reducer,
  translations,
  slots: {
    streamTabs: [Tab],
    streamTabPanes: [TabPane],
    commentInfoBar: [Tag],
    moderationActions: [ModActionButton],
    adminModeration: [ModSubscription],
    adminCommentInfoBar: [ModTag],
  },
  mutations: {
    IgnoreUser: ({variables}) => ({
      updateQueries: {
        CoralEmbedStream_Embed: (previous) => {
          if (!previous.asset.featuredComments) {
            return previous;
          }
          const ignoredUserId = variables.id;
          const newNodes = previous.asset.featuredComments.nodes.filter((n) => n.user.id !== ignoredUserId);
          const removedCount =  previous.asset.featuredComments.nodes.length - newNodes.length;
          const updated = update(previous, {
            asset: {
              featuredComments: {
                nodes: {$set: newNodes}
              },
              featuredCommentsCount: {
                $apply: (value) => value - removedCount,
              }
            }
          });
          return updated;
        }
      }
    }),
    AddTag: ({variables}) => ({
      updateQueries: {
        CoralEmbedStream_Embed: (previous) => {
          let updated = previous;

          if (variables.name !== 'FEATURED') {
            return;
          }

          const comment = findCommentInEmbedQuery(previous, variables.id);
                    
          if (previous.asset.comments) {
            updated = update(previous, {
              asset: {
                comments: {
                  nodes: {
                    $apply: (nodes) => nodes.map((node) => {
                      if (node.id === variables.id) {
                        node.status = 'ACCEPTED';
                      }
    
                      return node;
                    })
                  }
                },
                featuredComments: {
                  nodes: {
                    $apply: (nodes) => prependNewNodes(nodes, [comment]),
                  }
                },
                featuredCommentsCount: {
                  $apply: (value) => value + 1
                },
              }
            });
          }

          return updated;
        }
      },
      update: (proxy) => {

        if (name !== 'FEATURED') {
          return;
        }

        const fragmentId = `Comment_${variables.id}`;

        const fragment = gql`
          fragment Talk_ModerationActions_addTag on Comment {
            status
          }
        `;

        const data = proxy.readFragment({fragment, id: fragmentId});

        data.status = 'ACCEPTED';

        proxy.writeFragment({fragment, id: fragmentId, data});
      },
    }),
    RemoveTag: ({variables}) => ({
      updateQueries: {
        CoralEmbedStream_Embed: (previous) => {
          let updated = previous;
           
          if (variables.name !== 'FEATURED') {
            return;
          }

          if (previous.asset.comments) {
            updated = update(previous, {
              asset: {
                featuredComments: {
                  nodes: {
                    $apply: (nodes) =>
                      nodes.filter((n) => n.id !== variables.id)
                  }
                },
                featuredCommentsCount: {
                  $apply: (value) => value - 1
                }
              }
            });
          }

          return updated;
        },
      }
    })
  },
};
